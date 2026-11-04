ALTER TABLE public.students ADD COLUMN connectivity text NOT NULL DEFAULT 'unknown' CHECK (connectivity IN ('unknown','low_none','intermittent','medium','good'));
ALTER TABLE public.students ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.intervention_plans ADD COLUMN action_detail text NOT NULL DEFAULT '' CHECK (length(action_detail) <= 3000);
ALTER TABLE public.intervention_plans ADD COLUMN is_sample boolean NOT NULL DEFAULT false;

CREATE TABLE public.intervention_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
 school_id uuid NOT NULL REFERENCES public.schools(id),
 teacher_id uuid NOT NULL REFERENCES public.profiles(id),
 support_action text NOT NULL CHECK (support_action IN ('tutoring','resources','family','mentoring')),
 priority text NOT NULL CHECK (priority IN ('low','medium','high')),
 action_detail text NOT NULL CHECK (length(trim(action_detail)) BETWEEN 1 AND 3000),
 notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
 is_sample boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.intervention_proposals TO authenticated;
GRANT ALL ON public.intervention_proposals TO service_role;
ALTER TABLE public.intervention_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_proposals_read ON public.intervention_proposals FOR SELECT TO authenticated USING (teacher_id=auth.uid() AND school_id=public.edu_school() AND public.edu_has_role('teacher') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id=student_id AND s.teacher_id=auth.uid() AND s.school_id=intervention_proposals.school_id));
CREATE POLICY teacher_proposals_delete ON public.intervention_proposals FOR DELETE TO authenticated USING (teacher_id=auth.uid() AND school_id=public.edu_school() AND public.edu_has_role('teacher') AND EXISTS (SELECT 1 FROM public.students s WHERE s.id=student_id AND s.teacher_id=auth.uid() AND s.school_id=intervention_proposals.school_id));
CREATE INDEX intervention_proposals_teacher ON public.intervention_proposals (teacher_id, student_id);
CREATE TRIGGER notify_proposal_change AFTER INSERT OR UPDATE OR DELETE ON public.intervention_proposals FOR EACH ROW EXECUTE FUNCTION public.edu_notify_school();
CREATE FUNCTION public.edu_validate_proposal(wanted_proposal uuid, chosen_action text, chosen_priority text, chosen_detail text, chosen_notes text, confirmed_review boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE proposal public.intervention_proposals; plan_id uuid;
BEGIN
 IF auth.uid() IS NULL OR confirmed_review IS DISTINCT FROM true OR NOT public.edu_has_role('teacher') THEN RAISE EXCEPTION 'review_required'; END IF;
 SELECT * INTO proposal FROM public.intervention_proposals WHERE id=wanted_proposal AND teacher_id=auth.uid() AND school_id=public.edu_school() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proposal_unavailable'; END IF;
 IF length(trim(chosen_detail)) NOT BETWEEN 1 AND 3000 OR length(trim(chosen_notes)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'invalid_plan'; END IF;
 INSERT INTO public.intervention_plans(student_id,school_id,teacher_id,support_action,priority,action_detail,notes,reviewed,is_sample)
 VALUES(proposal.student_id,proposal.school_id,proposal.teacher_id,chosen_action,chosen_priority,trim(chosen_detail),trim(chosen_notes),true,proposal.is_sample) RETURNING id INTO plan_id;
 DELETE FROM public.intervention_proposals WHERE id=proposal.id;
 RETURN plan_id;
END;
$$;
REVOKE ALL ON FUNCTION public.edu_validate_proposal(uuid,text,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edu_validate_proposal(uuid,text,text,text,text,boolean) TO authenticated;
COMMENT ON TABLE public.intervention_proposals IS 'Unreviewed suggestions, never active intervention plans. Explicit teacher validation atomically creates a reviewed plan under caller RLS.';

CREATE TABLE public.institutional_sample_allocations (
 sample_key text NOT NULL,
 package_id text NOT NULL CHECK (package_id IN ('pilot','district','regional')),
 environment text NOT NULL DEFAULT 'sandbox' CHECK (environment='sandbox'),
 centre_count integer NOT NULL CHECK (centre_count BETWEEN 0 AND 10),
 PRIMARY KEY(sample_key,package_id)
);
GRANT ALL ON public.institutional_sample_allocations TO service_role;
ALTER TABLE public.institutional_sample_allocations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.institutional_sample_allocations IS 'Explicit sandbox-only demonstration capacity allocations. These are not purchases or licences and never enqueue purchase confirmation emails.';
CREATE OR REPLACE FUNCTION public.institutional_availability(wanted_environment text)
RETURNS TABLE (id text, amount_cents integer, max_centres integer, capacity integer, available integer)
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT p.id,p.amount_cents,p.max_centres,p.capacity,
 greatest(0,p.capacity-coalesce((SELECT sum(o.centre_count)::integer FROM public.institutional_orders o WHERE o.package_id=p.id AND o.environment=wanted_environment AND o.status IN ('preparing','pending','active')),0)-coalesce((SELECT sum(a.centre_count)::integer FROM public.institutional_sample_allocations a WHERE a.package_id=p.id AND a.environment=wanted_environment),0))
 FROM public.institutional_package_catalog() p;
$$;
REVOKE ALL ON FUNCTION public.institutional_availability(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_availability(text) TO service_role;
CREATE OR REPLACE FUNCTION public.institutional_reserve(
 wanted_package text,wanted_institution text,wanted_email text,wanted_mode text,wanted_centres jsonb,wanted_count integer,wanted_environment text,wanted_request uuid,wanted_access_hash text
) RETURNS public.institutional_orders LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p record; existing public.institutional_orders; result public.institutional_orders; remaining integer;
BEGIN
 IF wanted_environment NOT IN ('sandbox','live') OR length(wanted_institution) NOT BETWEEN 2 AND 200 OR length(wanted_email) NOT BETWEEN 3 AND 254 OR length(wanted_access_hash) <> 64 THEN RAISE EXCEPTION 'invalid_order'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('institutional-request:' || wanted_request::text,0));
 SELECT * INTO existing FROM public.institutional_orders WHERE request_key=wanted_request;
 IF FOUND THEN
  IF existing.access_hash <> wanted_access_hash OR existing.environment <> wanted_environment OR existing.package_id <> wanted_package OR existing.institution_name <> wanted_institution OR existing.billing_email <> wanted_email OR existing.beneficiary_mode <> wanted_mode OR existing.centre_count <> wanted_count OR existing.centres <> wanted_centres THEN RAISE EXCEPTION 'invalid_order'; END IF;
  RETURN existing;
 END IF;
 SELECT * INTO p FROM public.institutional_package_catalog() WHERE id=wanted_package;
 IF NOT FOUND OR wanted_count IS NULL OR wanted_count < 1 OR wanted_count > p.max_centres THEN RAISE EXCEPTION 'invalid_order'; END IF;
 IF wanted_mode NOT IN ('direct','solidarity') OR jsonb_typeof(wanted_centres) <> 'array' THEN RAISE EXCEPTION 'invalid_order'; END IF;
 IF (wanted_mode='direct' AND jsonb_array_length(wanted_centres) <> wanted_count) OR (wanted_mode='solidarity' AND jsonb_array_length(wanted_centres) <> 0) THEN RAISE EXCEPTION 'invalid_order'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(wanted_centres) c WHERE jsonb_typeof(c) <> 'string' OR length(trim(c #>> '{}')) NOT BETWEEN 2 AND 200) OR (SELECT count(DISTINCT lower(trim(c #>> '{}'))) FROM jsonb_array_elements(wanted_centres) c) <> jsonb_array_length(wanted_centres) THEN RAISE EXCEPTION 'invalid_order'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('institutional:' || wanted_environment || ':' || wanted_package,0));
 SELECT a.available INTO remaining FROM public.institutional_availability(wanted_environment) a WHERE a.id=wanted_package;
 IF remaining < wanted_count THEN RAISE EXCEPTION 'sold_out'; END IF;
 INSERT INTO public.institutional_orders(package_id,institution_name,billing_email,beneficiary_mode,centre_count,centres,amount_cents,environment,request_key,access_hash)
 VALUES(wanted_package,wanted_institution,wanted_email,wanted_mode,wanted_count,wanted_centres,p.amount_cents,wanted_environment,wanted_request,wanted_access_hash) RETURNING * INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_reserve(text,text,text,text,jsonb,integer,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_reserve(text,text,text,text,jsonb,integer,text,uuid,text) TO service_role;