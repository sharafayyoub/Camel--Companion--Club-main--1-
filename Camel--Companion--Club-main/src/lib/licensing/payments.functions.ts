import { createServerFn } from "@tanstack/react-start";
import {
  checkoutSchema,
  receiptSchema,
  PACKAGE_RULES,
  packageIdSchema,
  approvedCheckoutOrigin,
  type PackageAvailability,
  type Environment,
  type Receipt,
} from "./rules";

export const getPackages = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    packages: PackageAvailability[];
    environment: Environment | null;
    ready: boolean;
  }> => {
    try {
      const { paymentClient, reconcile } = await import("./payments.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { stripe, environment } = paymentClient();
      await reconcile(stripe, environment);
      const { data, error } = await supabaseAdmin.rpc("institutional_availability", {
        wanted_environment: environment,
      });
      if (error) throw error;
      return {
        packages: data.map((p) => ({ ...p, id: packageIdSchema.parse(p.id) })),
        environment,
        ready: true,
      };
    } catch {
      // Display real configured prices, but never invent available inventory.
      return {
        packages: Object.entries(PACKAGE_RULES).map(([id, p]) => ({
          id: packageIdSchema.parse(id),
          ...p,
          available: 0,
        })),
        environment: null,
        ready: false,
      };
    }
  },
);

export const createInstitutionalCheckout = createServerFn({ method: "POST" })
  .validator((data) => checkoutSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { url: string; order_id: string } | { error: "sold_out" | "unavailable" | "invalid_order" }
    > => {
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        const { paymentClient, hashAccess, reconcile, syncSession } =
          await import("./payments.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const request = getRequest();
        const origin = request.headers.get("origin");
        if (!origin) return { error: "invalid_order" };
        const parsedOrigin = new URL(origin);
        const allowedOrigins = [
          "http://localhost:8080",
          "https://camel-companion-club.lovable.app",
          "https://id-preview--58bcbc4c-e858-4b48-8cd1-f1344b1e7401.lovable.app",
          "https://project--58bcbc4c-e858-4b48-8cd1-f1344b1e7401.lovable.app",
          "https://project--58bcbc4c-e858-4b48-8cd1-f1344b1e7401-dev.lovable.app",
          ...(process.env["STRIPE_ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean),
        ];
        if (!approvedCheckoutOrigin(origin, allowedOrigins)) return { error: "invalid_order" };
        const { stripe, environment } = paymentClient();
        // A hard Stripe validation failure has created no session; a transport
        // timeout remains unknown and must keep capacity reserved.
        let creationRejected = false;
        await reconcile(stripe, environment);
        const c = data.contract;
        const { data: order, error } = await supabaseAdmin.rpc("institutional_reserve", {
          wanted_package: c.package_id,
          wanted_institution: c.institution_name,
          wanted_email: c.billing_email,
          wanted_mode: c.beneficiary_mode,
          wanted_centres: c.centres,
          wanted_count: c.centre_count,
          wanted_environment: environment,
          wanted_request: data.request_key,
          wanted_access_hash: hashAccess(data.access_token),
        });
        if (error)
          return { error: error.message.includes("sold_out") ? "sold_out" : "invalid_order" };
        if (order.status === "cancelled") return { error: "invalid_order" };
        if (order.status === "active")
          return {
            url: `${parsedOrigin.origin}/contratacion/resultado?order=${order.id}`,
            order_id: order.id,
          };
        if (order.stripe_session_id) {
          const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          await syncSession(order, session);
          if (session.status === "complete" && session.payment_status === "paid")
            return {
              url: `${parsedOrigin.origin}/contratacion/resultado?order=${order.id}`,
              order_id: order.id,
            };
          if (session.status === "open" && session.url)
            return { url: session.url, order_id: order.id };
          return { error: "invalid_order" };
        }
        const expiresAt = Math.floor(new Date(order.created_at).getTime() / 1000) + 40 * 60;
        if (expiresAt < Math.floor(Date.now() / 1000) + 30 * 60) return { error: "unavailable" };
        const { error: languageError } = await supabaseAdmin
          .from("institutional_orders")
          .update({ email_language: data.language })
          .eq("id", order.id)
          .eq("status", "preparing");
        if (languageError) return { error: "unavailable" };
        const locale =
          data.language === "en"
            ? await import("@/i18n/locales/en.json")
            : data.language === "fr"
              ? await import("@/i18n/locales/fr.json")
              : await import("@/i18n/locales/es.json");
        const packageName = locale.default.licensing.packages[c.package_id].name;
        const session = await stripe.checkout.sessions
          .create(
            {
              mode: "payment",
              payment_method_types: ["card"],
              customer_email: order.billing_email,
              client_reference_id: order.id,
              metadata: { institutional_order_id: order.id, package_id: order.package_id },
              payment_intent_data: {
                metadata: { institutional_order_id: order.id, package_id: order.package_id },
              },
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: order.currency,
                    unit_amount: order.amount_cents,
                    product_data: {
                      name: packageName,
                      tax_code: PACKAGE_RULES[c.package_id].tax_code,
                    },
                    tax_behavior: "inclusive",
                  },
                },
              ],
              automatic_tax: { enabled: true },
              billing_address_collection: "required",
              tax_id_collection: { enabled: true },
              locale: data.language,
              expires_at: expiresAt,
              success_url: `${parsedOrigin.origin}/contratacion/resultado?order=${order.id}`,
              cancel_url: `${parsedOrigin.origin}/contratacion/resultado?order=${order.id}&cancelled=true`,
            },
            { idempotencyKey: `institutional-${order.id}` },
          )
          .catch(async (stripeError: { type?: string; code?: string }) => {
            if (
              [
                "StripeInvalidRequestError",
                "StripeAuthenticationError",
                "StripePermissionError",
              ].includes(stripeError.type ?? "")
            ) {
              creationRejected = true;
              const { error: releaseError } = await supabaseAdmin
                .from("institutional_orders")
                .update({ status: "cancelled" })
                .eq("id", order.id)
                .eq("status", "preparing");
              if (releaseError) throw new Error("unavailable");
            }
            console.error("Institutional checkout rejected", {
              type: stripeError.type,
              code: stripeError.code,
              definite: creationRejected,
            });
            throw new Error("unavailable");
          });
        if (!session.url) return { error: "unavailable" };
        const { data: bound, error: bindError } = await supabaseAdmin
          .from("institutional_orders")
          .update({
            stripe_session_id: session.id,
            stripe_expires_at: new Date(session.expires_at * 1000).toISOString(),
            status: "pending",
          })
          .eq("id", order.id)
          .eq("status", "preparing")
          .select("id");
        if (bindError) return { error: "unavailable" };
        if (bound.length !== 1) {
          const { data: concurrent, error: readError } = await supabaseAdmin
            .from("institutional_orders")
            .select("*")
            .eq("id", order.id)
            .single();
          if (
            readError ||
            concurrent.stripe_session_id !== session.id ||
            concurrent.status === "cancelled"
          )
            return { error: "unavailable" };
          await syncSession(concurrent, session);
        }
        return { url: session.url, order_id: order.id };
      } catch {
        // A timeout is not proof that no session exists. Keep the reservation
        // and reconcile via the immutable order metadata instead of overselling.
        return { error: "unavailable" };
      }
    },
  );

export const verifyInstitutionalPayment = createServerFn({ method: "POST" })
  .validator((data) => receiptSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ receipt: Receipt } | { error: "invalid_receipt" | "unavailable" }> => {
      try {
        const { paymentClient, readOrder, syncSession, reconcile, getReceipt } =
          await import("./payments.server");
        const { stripe, environment } = paymentClient();
        const order = await readOrder(data.order_id, data.access_token, environment);
        if (order.stripe_session_id)
          await syncSession(
            order,
            await stripe.checkout.sessions.retrieve(order.stripe_session_id),
          );
        else await reconcile(stripe, environment);
        return { receipt: await getReceipt(order) };
      } catch (e) {
        return {
          error:
            e instanceof Error && e.message === "invalid_receipt"
              ? "invalid_receipt"
              : "unavailable",
        };
      }
    },
  );

export const cancelInstitutionalCheckout = createServerFn({ method: "POST" })
  .validator((data) => receiptSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ receipt: Receipt } | { error: "invalid_receipt" | "unavailable" }> => {
      try {
        const { paymentClient, readOrder, syncSession, getReceipt } =
          await import("./payments.server");
        const { stripe, environment } = paymentClient();
        const order = await readOrder(data.order_id, data.access_token, environment);
        if (order.stripe_session_id) {
          let session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          if (session.status === "open") {
            try {
              session = await stripe.checkout.sessions.expire(session.id);
            } catch {
              session = await stripe.checkout.sessions.retrieve(session.id);
            }
          }
          await syncSession(order, session);
        }
        return { receipt: await getReceipt(order) };
      } catch (e) {
        return {
          error:
            e instanceof Error && e.message === "invalid_receipt"
              ? "invalid_receipt"
              : "unavailable",
        };
      }
    },
  );
