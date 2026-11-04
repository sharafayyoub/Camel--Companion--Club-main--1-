-- Local migration only. Apply to a staging Supabase project before production.
ALTER TABLE public.intervention_plans DROP CONSTRAINT intervention_plans_status_check;
ALTER TABLE public.intervention_plans ADD CONSTRAINT intervention_plans_status_check
 CHECK (status IN ('pendiente','en_curso','completado','descartado'));

CREATE TABLE public.impact_studies (
 plan_id uuid PRIMARY KEY REFERENCES public.intervention_plans(id) ON DELETE CASCADE,
 actions text[] NOT NULL CHECK (cardinality(actions) BETWEEN 1 AND 4 AND actions <@ ARRAY['tutoring','resources','family','mentoring']::text[]),
 duration_weeks integer NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
 baseline_attendance numeric NOT NULL CHECK (baseline_attendance BETWEEN 0 AND 100),
 baseline_grade numeric NOT NULL CHECK (baseline_grade BETWEEN 0 AND 10),
 baseline_submissions numeric NOT NULL CHECK (baseline_submissions BETWEEN 0 AND 100),
 baseline_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.impact_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES public.impact_studies(plan_id) ON DELETE CASCADE,
 observed_on date NOT NULL,
 attendance numeric NOT NULL CHECK (attendance BETWEEN 0 AND 100),
 grade numeric NOT NULL CHECK (grade BETWEEN 0 AND 10),
 submissions numeric NOT NULL CHECK (submissions BETWEEN 0 AND 100),
 notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 1 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(plan_id,observed_on)
);
CREATE INDEX impact_followups_plan_date ON public.impact_followups(plan_id,observed_on DESC);
ALTER TABLE public.impact_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.impact_studies, public.impact_followups FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.impact_studies, public.impact_followups TO authenticated;
GRANT ALL ON public.impact_studies, public.impact_followups TO service_role;
CREATE POLICY teacher_impact_read ON public.impact_studies FOR SELECT TO authenticated
 USING (public.edu_has_role('teacher') AND EXISTS (SELECT 1 FROM public.intervention_plans p WHERE p.id=plan_id AND p.teacher_id=auth.uid() AND p.school_id=public.edu_school()));
CREATE POLICY teacher_followup_read ON public.impact_followups FOR SELECT TO authenticated
 USING (public.edu_has_role('teacher') AND EXISTS (SELECT 1 FROM public.intervention_plans p WHERE p.id=plan_id AND p.teacher_id=auth.uid() AND p.school_id=public.edu_school()));

-- SECURITY DEFINER is required because direct snapshot/evidence writes are revoked.
-- Every RPC checks role, school and ownership explicitly before any write.
CREATE FUNCTION public.edu_save_impact_plan(wanted_student uuid, wanted_plan uuid, chosen_actions text[], chosen_weeks integer, chosen_priority text, chosen_objective text, chosen_notes text, confirmed_review boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.students; p public.intervention_plans; pid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.edu_has_role('teacher') OR confirmed_review IS DISTINCT FROM true THEN RAISE EXCEPTION 'review_required'; END IF;
 IF chosen_actions IS NULL OR cardinality(chosen_actions) NOT BETWEEN 1 AND 4
 OR array_position(chosen_actions,NULL) IS NOT NULL
 OR NOT chosen_actions <@ ARRAY['tutoring','resources','family','mentoring']::text[]
 OR (SELECT count(DISTINCT a) FROM unnest(chosen_actions) a)<>cardinality(chosen_actions)
 OR chosen_weeks IS NULL OR chosen_weeks NOT BETWEEN 1 AND 52
 OR chosen_priority IS NULL OR chosen_priority NOT IN ('low','medium','high')
 OR chosen_objective IS NULL OR length(trim(chosen_objective)) NOT BETWEEN 3 AND 3000
 OR chosen_notes IS NULL OR length(trim(chosen_notes)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'invalid_design'; END IF;
 SELECT * INTO s FROM public.students WHERE id=wanted_student AND teacher_id=auth.uid() AND school_id=public.edu_school() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'student_unavailable'; END IF;
 IF wanted_plan IS NULL THEN
  INSERT INTO public.intervention_plans(student_id,school_id,teacher_id,support_action,priority,action_detail,notes,reviewed,is_sample)
  VALUES(s.id,s.school_id,s.teacher_id,chosen_actions[1],chosen_priority,trim(chosen_objective),trim(chosen_notes),true,s.is_sample) RETURNING id INTO pid;
 ELSE
  SELECT * INTO p FROM public.intervention_plans WHERE id=wanted_plan AND student_id=s.id AND teacher_id=auth.uid() AND school_id=s.school_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_unavailable'; END IF;
  pid:=p.id;
  UPDATE public.intervention_plans SET support_action=chosen_actions[1],priority=chosen_priority,action_detail=trim(chosen_objective),notes=trim(chosen_notes),reviewed=true,reviewed_at=now(),is_sample=s.is_sample WHERE id=pid;
 END IF;
 INSERT INTO public.impact_studies(plan_id,actions,duration_weeks,baseline_attendance,baseline_grade,baseline_submissions,baseline_on)
 VALUES(pid,chosen_actions,chosen_weeks,s.attendance,s.grade,s.submissions,(s.updated_at AT TIME ZONE 'UTC')::date)
 ON CONFLICT(plan_id) DO UPDATE SET actions=excluded.actions,duration_weeks=excluded.duration_weeks;
 -- Updating a design never overwrites its original baseline or follow-ups.
 PERFORM public.edu_emit_impact_change(s.school_id);
 RETURN pid;
END $$;

CREATE FUNCTION public.edu_record_impact(wanted_plan uuid, measured_on date, measured_attendance numeric, measured_grade numeric, measured_submissions numeric, teacher_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE baseline_day date; fid uuid; sid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.edu_has_role('teacher') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT i.baseline_on,p.school_id INTO baseline_day,sid FROM public.impact_studies i JOIN public.intervention_plans p ON p.id=i.plan_id
 WHERE p.id=wanted_plan AND p.teacher_id=auth.uid() AND p.school_id=public.edu_school() AND p.status<>'descartado' FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'plan_unavailable'; END IF;
 IF measured_on IS NULL OR measured_on<baseline_day OR measured_on>(now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'invalid_date'; END IF;
 INSERT INTO public.impact_followups(plan_id,observed_on,attendance,grade,submissions,notes)
 VALUES(wanted_plan,measured_on,measured_attendance,measured_grade,measured_submissions,trim(teacher_notes)) RETURNING id INTO fid;
 PERFORM public.edu_emit_impact_change(sid);
 RETURN fid;
END $$;

-- No educational or billing data enters notification payloads.
CREATE FUNCTION public.edu_emit_impact_change(sid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE member_id uuid;
BEGIN
 FOR member_id IN SELECT user_id FROM public.user_roles WHERE school_id=sid LOOP
  PERFORM realtime.send('{}'::jsonb,'changed','edupulse:'||member_id::text,true);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.edu_emit_impact_change(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.edu_impact_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.edu_school() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 WITH measured AS (
  SELECT DISTINCT ON(p.student_id) p.student_id,p.support_action AS action,
   f.attendance-i.baseline_attendance AS attendance_change,
   f.grade-i.baseline_grade AS grade_change,f.submissions-i.baseline_submissions AS submissions_change
  FROM public.intervention_plans p JOIN public.students s ON s.id=p.student_id
  JOIN public.impact_studies i ON i.plan_id=p.id
  JOIN LATERAL (SELECT * FROM public.impact_followups WHERE plan_id=p.id ORDER BY observed_on DESC,created_at DESC,id DESC LIMIT 1) f ON true
  WHERE p.school_id=public.edu_school() AND (public.edu_has_role('director') OR p.teacher_id=auth.uid())
   AND NOT s.is_sample AND NOT p.is_sample AND p.status<>'descartado'
  ORDER BY p.student_id,f.observed_on DESC,f.created_at DESC,p.id
 ), cohorts AS (
  SELECT action,count(*) AS students,round(avg(attendance_change),1) AS attendance_change,
   round(avg(grade_change),1) AS grade_change,round(avg(submissions_change),1) AS submissions_change
  FROM measured GROUP BY action HAVING count(*)>=5
 ) SELECT coalesce(jsonb_agg(cohorts ORDER BY action),'[]'::jsonb) INTO result FROM cohorts;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.edu_save_impact_plan(uuid,uuid,text[],integer,text,text,text,boolean),public.edu_record_impact(uuid,date,numeric,numeric,numeric,text),public.edu_impact_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edu_save_impact_plan(uuid,uuid,text[],integer,text,text,text,boolean),public.edu_record_impact(uuid,date,numeric,numeric,numeric,text),public.edu_impact_summary() TO authenticated;

-- A plan remains tied to its original student/owner once it contains evidence.
CREATE FUNCTION public.edu_guard_impact_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (NEW.student_id,NEW.school_id,NEW.teacher_id) IS DISTINCT FROM (OLD.student_id,OLD.school_id,OLD.teacher_id)
 AND EXISTS(SELECT 1 FROM public.impact_studies WHERE plan_id=OLD.id) THEN RAISE EXCEPTION 'immutable_impact_owner'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_impact_owner BEFORE UPDATE ON public.intervention_plans FOR EACH ROW EXECUTE FUNCTION public.edu_guard_impact_plan();
REVOKE ALL ON FUNCTION public.edu_guard_impact_plan() FROM PUBLIC,anon,authenticated;

-- Correct the audit stamp: a changed action detail is also a new human review.
CREATE OR REPLACE FUNCTION public.edu_stamp_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.created_at=now(); NEW.reviewed_at=now();
 ELSE NEW.created_at=OLD.created_at;
 NEW.reviewed_at=CASE WHEN (NEW.support_action,NEW.priority,NEW.notes,NEW.action_detail) IS DISTINCT FROM (OLD.support_action,OLD.priority,OLD.notes,OLD.action_detail) THEN now() ELSE OLD.reviewed_at END;
 END IF; RETURN NEW;
END $$;
COMMENT ON TABLE public.impact_studies IS 'Teacher-reviewed designs linked 1:1 to existing plans. Server-captured immutable baseline; no simulated targets stored as observations.';
COMMENT ON TABLE public.impact_followups IS 'Append-only teacher observations, one per plan per UTC day. Changes are descriptive, not causal estimates. Submissions is a participation proxy.';
