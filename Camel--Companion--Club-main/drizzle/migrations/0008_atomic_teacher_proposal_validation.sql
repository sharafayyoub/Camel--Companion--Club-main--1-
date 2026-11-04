CREATE OR REPLACE FUNCTION public.edu_validate_proposal(wanted_proposal uuid, chosen_action text, chosen_priority text, chosen_detail text, chosen_notes text, confirmed_review boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE proposal public.intervention_proposals; plan_id uuid;
BEGIN
 IF auth.uid() IS NULL OR confirmed_review IS DISTINCT FROM true OR NOT public.edu_has_role('teacher') THEN RAISE EXCEPTION 'review_required'; END IF;
 IF length(trim(chosen_detail)) NOT BETWEEN 1 AND 3000 OR length(trim(chosen_notes)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'invalid_plan'; END IF;
 DELETE FROM public.intervention_proposals WHERE id=wanted_proposal AND teacher_id=auth.uid() AND school_id=public.edu_school() RETURNING * INTO proposal;
 IF NOT FOUND THEN RAISE EXCEPTION 'proposal_unavailable'; END IF;
 INSERT INTO public.intervention_plans(student_id,school_id,teacher_id,support_action,priority,action_detail,notes,reviewed,is_sample)
 VALUES(proposal.student_id,proposal.school_id,proposal.teacher_id,chosen_action,chosen_priority,trim(chosen_detail),trim(chosen_notes),true,proposal.is_sample) RETURNING id INTO plan_id;
 RETURN plan_id;
END;
$$;
REVOKE ALL ON FUNCTION public.edu_validate_proposal(uuid,text,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edu_validate_proposal(uuid,text,text,text,text,boolean) TO authenticated;