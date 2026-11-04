CREATE TABLE public.institutional_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id text NOT NULL,
  institution_name text NOT NULL,
  billing_email text NOT NULL,
  beneficiary_mode text NOT NULL CHECK (beneficiary_mode IN ('direct', 'solidarity')),
  centre_count integer NOT NULL CHECK (centre_count BETWEEN 1 AND 15),
  centres jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'eur' CHECK (currency = 'eur'),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'pending', 'active', 'cancelled')),
  request_key uuid NOT NULL UNIQUE,
  access_hash text NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT ALL ON public.institutional_orders TO service_role;
REVOKE ALL ON public.institutional_orders FROM anon, authenticated;
ALTER TABLE public.institutional_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.institutional_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.institutional_orders(id),
  institution_name text NOT NULL,
  billing_email text NOT NULL,
  package_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  centre_count integer NOT NULL,
  beneficiary_mode text NOT NULL,
  centres jsonb NOT NULL,
  assignment_status text NOT NULL CHECK (assignment_status IN ('designated', 'awaiting_solidarity_assignment')),
  status text NOT NULL DEFAULT 'active' CHECK (status = 'active'),
  activated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.institutional_licenses TO service_role;
REVOKE ALL ON public.institutional_licenses FROM anon, authenticated;
ALTER TABLE public.institutional_licenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX institutional_orders_capacity ON public.institutional_orders (environment, package_id, status);

CREATE FUNCTION public.institutional_package_catalog()
RETURNS TABLE (id text, amount_cents integer, max_centres integer, capacity integer)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  VALUES ('pilot'::text, 49000, 1, 10), ('district'::text, 185000, 5, 5), ('regional'::text, 450000, 15, 2);
$$;
REVOKE ALL ON FUNCTION public.institutional_package_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_package_catalog() TO service_role;

CREATE FUNCTION public.institutional_availability(wanted_environment text)
RETURNS TABLE (id text, amount_cents integer, max_centres integer, capacity integer, available integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.id, p.amount_cents, p.max_centres, p.capacity,
    greatest(0, p.capacity - coalesce((SELECT sum(o.centre_count)::integer
      FROM public.institutional_orders o WHERE o.package_id = p.id
      AND o.environment = wanted_environment AND o.status IN ('preparing','pending','active')), 0))
  FROM public.institutional_package_catalog() p;
$$;
REVOKE ALL ON FUNCTION public.institutional_availability(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_availability(text) TO service_role;

CREATE FUNCTION public.institutional_reserve(
  wanted_package text, wanted_institution text, wanted_email text,
  wanted_mode text, wanted_centres jsonb, wanted_count integer,
  wanted_environment text, wanted_request uuid, wanted_access_hash text
) RETURNS public.institutional_orders
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p record; existing public.institutional_orders; result public.institutional_orders; used integer;
BEGIN
  IF wanted_environment NOT IN ('sandbox','live') OR length(wanted_institution) NOT BETWEEN 2 AND 200
    OR length(wanted_email) NOT BETWEEN 3 AND 254 OR length(wanted_access_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('institutional-request:' || wanted_request::text, 0));
  SELECT * INTO existing FROM public.institutional_orders WHERE request_key = wanted_request;
  IF FOUND THEN
    IF existing.access_hash <> wanted_access_hash OR existing.environment <> wanted_environment
      OR existing.package_id <> wanted_package OR existing.institution_name <> wanted_institution
      OR existing.billing_email <> wanted_email OR existing.beneficiary_mode <> wanted_mode
      OR existing.centre_count <> wanted_count OR existing.centres <> wanted_centres THEN
      RAISE EXCEPTION 'invalid_order';
    END IF;
    RETURN existing;
  END IF;
  SELECT * INTO p FROM public.institutional_package_catalog() WHERE id = wanted_package;
  IF NOT FOUND OR wanted_count IS NULL OR wanted_count < 1 OR wanted_count > p.max_centres THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  IF wanted_mode NOT IN ('direct','solidarity') OR jsonb_typeof(wanted_centres) <> 'array' THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  IF (wanted_mode = 'direct' AND jsonb_array_length(wanted_centres) <> wanted_count)
    OR (wanted_mode = 'solidarity' AND jsonb_array_length(wanted_centres) <> 0) THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(wanted_centres) c
    WHERE jsonb_typeof(c) <> 'string' OR length(trim(c #>> '{}')) NOT BETWEEN 2 AND 200)
    OR (SELECT count(DISTINCT lower(trim(c #>> '{}'))) FROM jsonb_array_elements(wanted_centres) c)
       <> jsonb_array_length(wanted_centres) THEN
    RAISE EXCEPTION 'invalid_order';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('institutional:' || wanted_environment || ':' || wanted_package, 0));
  SELECT coalesce(sum(centre_count),0)::integer INTO used FROM public.institutional_orders
    WHERE package_id = wanted_package AND environment = wanted_environment AND status IN ('preparing','pending','active');
  IF p.capacity - used < wanted_count THEN RAISE EXCEPTION 'sold_out'; END IF;
  INSERT INTO public.institutional_orders (package_id,institution_name,billing_email,beneficiary_mode,centre_count,centres,
    amount_cents,environment,request_key,access_hash)
  VALUES (wanted_package,wanted_institution,wanted_email,wanted_mode,wanted_count,wanted_centres,
    p.amount_cents,wanted_environment,wanted_request,wanted_access_hash) RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_reserve(text,text,text,text,jsonb,integer,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_reserve(text,text,text,text,jsonb,integer,text,uuid,text) TO service_role;

CREATE FUNCTION public.institutional_activate(wanted_order uuid, wanted_session text, verified_amount integer, verified_currency text, verified_environment text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.institutional_orders; licence uuid;
BEGIN
  SELECT * INTO o FROM public.institutional_orders WHERE id = wanted_order FOR UPDATE;
  IF NOT FOUND OR o.stripe_session_id IS DISTINCT FROM wanted_session OR o.amount_cents <> verified_amount
    OR o.currency <> verified_currency OR o.environment <> verified_environment OR o.status = 'cancelled' THEN
    RAISE EXCEPTION 'invalid_payment';
  END IF;
  IF o.status = 'active' THEN SELECT id INTO licence FROM public.institutional_licenses WHERE order_id = o.id; RETURN licence; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'invalid_payment'; END IF;
  INSERT INTO public.institutional_licenses (order_id,institution_name,billing_email,package_id,environment,
    centre_count,beneficiary_mode,centres,assignment_status)
  VALUES (o.id,o.institution_name,o.billing_email,o.package_id,o.environment,o.centre_count,o.beneficiary_mode,o.centres,
    CASE WHEN o.beneficiary_mode = 'direct' THEN 'designated' ELSE 'awaiting_solidarity_assignment' END)
  RETURNING id INTO licence;
  UPDATE public.institutional_orders SET status = 'active', paid_at = now() WHERE id = o.id;
  RETURN licence;
END;
$$;
REVOKE ALL ON FUNCTION public.institutional_activate(uuid,text,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institutional_activate(uuid,text,integer,text,text) TO service_role;
COMMENT ON TABLE public.institutional_orders IS 'Private guest orders. Pending/preparing reserve centre capacity; only Stripe-verified active orders consume fulfilled places. Test and live inventories are separate.';
COMMENT ON TABLE public.institutional_licenses IS 'Paid support/training contracts, not automatic school membership grants. Solidarity places await real beneficiary designation.';