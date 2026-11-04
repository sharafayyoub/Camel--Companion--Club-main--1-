-- Complementary suppression prevents totals from revealing a single hidden subgroup.
CREATE INDEX IF NOT EXISTS plans_school_teacher_student ON public.intervention_plans(school_id,teacher_id,student_id);
CREATE FUNCTION public.edu_safe_count(n bigint, total bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN n=0 OR (n>=5 AND (total-n=0 OR total-n>=5)) THEN n ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.edu_safe_count(bigint,bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.edu_dashboard() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; director boolean; student_count bigint;
BEGIN
 IF auth.uid() IS NULL OR public.edu_school() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
 director:=public.edu_has_role('director');
 SELECT count(*) INTO student_count FROM public.students
 WHERE school_id=public.edu_school() AND (NOT director OR NOT is_sample) AND (director OR teacher_id=auth.uid());
 IF director AND student_count<5 THEN
  RETURN jsonb_build_object('privacySuppressed',true,'containsSamples',false,'total',0,'active',NULL,'withdrawn',NULL,'completed',NULL,
   'retention',NULL,'attendance',NULL,'grade',NULL,'submissions',NULL,'resources',NULL,'priority',NULL,'plans',NULL,'completedPlans',NULL,
   'groups','[]'::jsonb,'trend','[]'::jsonb,'impact','[]'::jsonb);
 END IF;
 WITH visible AS (
  SELECT * FROM public.students WHERE school_id=public.edu_school() AND (director OR teacher_id=auth.uid()) AND (NOT director OR NOT is_sample)
 ), gs AS (
  SELECT course AS grupo,count(*) AS total,round(avg(attendance),1) AS asistencia,round(avg(grade),1) AS nota_media,
   round(avg(submissions),1) AS tareas_entregadas,round(avg(resource_usage),1) AS recursos FROM visible GROUP BY course
 ), daily AS (
  SELECT DISTINCT ON(h.student_id,(h.recorded_at AT TIME ZONE 'UTC')::date)
   h.student_id,(h.recorded_at AT TIME ZONE 'UTC')::date AS day,h.attendance,h.grade
  FROM public.metric_history h JOIN visible s ON s.id=h.student_id
  ORDER BY h.student_id,(h.recorded_at AT TIME ZONE 'UTC')::date,h.recorded_at DESC,h.id DESC
 ), trend AS (
  SELECT day::text,round(avg(attendance),1) AS attendance,round(avg(grade),1) AS grade FROM daily
  GROUP BY day HAVING NOT director OR count(*)>=5 ORDER BY day DESC LIMIT 30
 ), impact AS (
  SELECT CASE WHEN s.resource_usage>=50 THEN 'high' ELSE 'low' END AS usage,count(*) AS total,
   round(avg(s.attendance),1) AS attendance,round(avg(s.submissions),1) AS submissions,round(avg(s.grade),1) AS grade,
   round(avg(s.attendance-first_metric.attendance) FILTER(WHERE history_count.n>1),1) AS change
  FROM visible s JOIN LATERAL(SELECT attendance FROM public.metric_history WHERE student_id=s.id ORDER BY recorded_at,id LIMIT 1) first_metric ON true
  JOIN LATERAL(SELECT count(*) AS n FROM public.metric_history WHERE student_id=s.id) history_count ON true
  GROUP BY CASE WHEN s.resource_usage>=50 THEN 'high' ELSE 'low' END
 ), ps AS (
  SELECT p.* FROM public.intervention_plans p JOIN visible s ON s.id=p.student_id
  WHERE p.school_id=public.edu_school() AND (director OR p.teacher_id=auth.uid()) AND (NOT director OR NOT p.is_sample)
 )
 SELECT jsonb_build_object('privacySuppressed',false,'containsSamples',coalesce(bool_or(is_sample),false),'total',count(*),
  'active',CASE WHEN director THEN public.edu_safe_count(count(*) FILTER(WHERE enrollment_status='active'),count(*)) ELSE count(*) FILTER(WHERE enrollment_status='active') END,
  'withdrawn',CASE WHEN director THEN public.edu_safe_count(count(*) FILTER(WHERE enrollment_status='withdrawn'),count(*)) ELSE count(*) FILTER(WHERE enrollment_status='withdrawn') END,
  'completed',CASE WHEN director THEN public.edu_safe_count(count(*) FILTER(WHERE enrollment_status='completed'),count(*)) ELSE count(*) FILTER(WHERE enrollment_status='completed') END,
  'retention',CASE WHEN count(*)>0 AND (NOT director OR public.edu_safe_count(count(*) FILTER(WHERE enrollment_status='withdrawn'),count(*)) IS NOT NULL) THEN round(100.0*count(*) FILTER(WHERE enrollment_status<>'withdrawn')/count(*),1) ELSE NULL END,
  'attendance',round(avg(attendance),1),'grade',round(avg(grade),1),'submissions',round(avg(submissions),1),'resources',round(avg(resource_usage),1),
  'priority',CASE WHEN director THEN public.edu_safe_count(count(*) FILTER(WHERE attendance<75 OR grade<5 OR submissions<60),count(*)) ELSE count(*) FILTER(WHERE attendance<75 OR grade<5 OR submissions<60) END,
  'plans',(SELECT CASE WHEN NOT director OR count(*)=0 OR count(DISTINCT student_id)>=5 THEN count(*) ELSE NULL END FROM ps),
  'completedPlans',(SELECT CASE WHEN NOT director OR count(*) FILTER(WHERE status='completado')=0 OR (count(DISTINCT student_id) FILTER(WHERE status='completado')>=5 AND (count(DISTINCT student_id) FILTER(WHERE status<>'completado')>=5 OR count(*) FILTER(WHERE status<>'completado')=0)) THEN count(*) FILTER(WHERE status='completado') ELSE NULL END FROM ps),
  'groups',CASE WHEN director AND EXISTS(SELECT 1 FROM gs WHERE total<5) THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(gs ORDER BY grupo) FROM gs),'[]'::jsonb) END,
  'trend',coalesce((SELECT jsonb_agg(trend ORDER BY day) FROM trend),'[]'::jsonb),
  'impact',CASE WHEN director AND EXISTS(SELECT 1 FROM impact WHERE total<5) THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(impact ORDER BY usage) FROM impact),'[]'::jsonb) END
 ) INTO result FROM visible;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.edu_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edu_dashboard() TO authenticated;

-- Sample provenance cannot be cleared by a teacher to enter institutional evidence.
CREATE FUNCTION public.edu_guard_sample_student() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.is_sample AND NOT NEW.is_sample AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'sample_provenance_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_sample_student BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.edu_guard_sample_student();
REVOKE ALL ON FUNCTION public.edu_guard_sample_student() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.edu_stamp_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 SELECT s.is_sample INTO NEW.is_sample FROM public.students s WHERE s.id=NEW.student_id;
 IF TG_OP='INSERT' THEN NEW.created_at=now(); NEW.reviewed_at=now();
 ELSE NEW.created_at=OLD.created_at;
 NEW.reviewed_at=CASE WHEN (NEW.support_action,NEW.priority,NEW.notes,NEW.action_detail) IS DISTINCT FROM (OLD.support_action,OLD.priority,OLD.notes,OLD.action_detail) OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN now() ELSE OLD.reviewed_at END;
 END IF; RETURN NEW;
END $$;
