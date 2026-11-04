REVOKE INSERT, UPDATE, DELETE ON public.user_roles, public.schools, public.school_invites FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.metric_history FROM authenticated;
COMMENT ON FUNCTION public.edu_create_school(text,public.edu_role) IS 'Creates a new isolated school only; existing membership cannot be changed. Existing schools require an email-bound director invitation.';