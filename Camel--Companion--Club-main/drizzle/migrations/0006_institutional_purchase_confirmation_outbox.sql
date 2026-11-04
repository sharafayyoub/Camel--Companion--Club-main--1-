ALTER TABLE public.institutional_orders ADD COLUMN email_language text NOT NULL DEFAULT 'es' CHECK (email_language IN ('es','en','fr'));
CREATE TABLE public.institutional_confirmation_emails (
  order_id uuid PRIMARY KEY REFERENCES public.institutional_orders(id) ON DELETE CASCADE,
  license_id uuid NOT NULL REFERENCES public.institutional_licenses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','needs_review')),
  payload jsonb,
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  attempt_token uuid,
  provider_email_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.institutional_confirmation_emails TO service_role;
REVOKE ALL ON public.institutional_confirmation_emails FROM anon, authenticated;
ALTER TABLE public.institutional_confirmation_emails ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.institutional_queue_confirmation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.institutional_confirmation_emails(order_id,license_id) VALUES(NEW.order_id,NEW.id) ON CONFLICT(order_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_queue_confirmation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_queue_confirmation() TO service_role;
CREATE TRIGGER institutional_license_confirmation AFTER INSERT ON public.institutional_licenses FOR EACH ROW EXECUTE FUNCTION public.institutional_queue_confirmation();
CREATE FUNCTION public.institutional_claim_confirmation(wanted_order uuid DEFAULT NULL) RETURNS SETOF public.institutional_confirmation_emails LANGUAGE plpgsql SET search_path = public AS $$
DECLARE job public.institutional_confirmation_emails;
BEGIN
  SELECT e.* INTO job FROM public.institutional_confirmation_emails e JOIN public.institutional_orders o ON o.id=e.order_id
  WHERE o.status='active' AND (wanted_order IS NULL OR e.order_id=wanted_order)
    AND e.status IN ('pending','sending') AND e.next_attempt_at<=now() AND (e.lease_until IS NULL OR e.lease_until<=now())
  ORDER BY e.created_at FOR UPDATE OF e SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF job.first_attempt_at IS NOT NULL AND job.first_attempt_at < now()-interval '23 hours' THEN
    UPDATE public.institutional_confirmation_emails SET status='needs_review',last_error='idempotency_window_elapsed',lease_until=NULL WHERE order_id=job.order_id;
    RETURN;
  END IF;
  RETURN QUERY UPDATE public.institutional_confirmation_emails SET status='sending',attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',attempt_token=gen_random_uuid()
    WHERE order_id=job.order_id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_claim_confirmation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_claim_confirmation(uuid) TO service_role;
CREATE FUNCTION public.institutional_finish_confirmation(wanted_order uuid,wanted_token uuid,provider_id text DEFAULT NULL,error_code text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.institutional_confirmation_emails SET
    status=CASE WHEN provider_id IS NOT NULL THEN 'sent' ELSE 'pending' END,
    provider_email_id=coalesce(provider_id,provider_email_id),sent_at=CASE WHEN provider_id IS NOT NULL THEN now() ELSE sent_at END,
    next_attempt_at=now()+least(attempts*60,900)*interval '1 second',lease_until=NULL,last_error=left(error_code,160)
  WHERE order_id=wanted_order AND attempt_token=wanted_token AND status='sending';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_finish_confirmation(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_finish_confirmation(uuid,uuid,text,text) TO service_role;