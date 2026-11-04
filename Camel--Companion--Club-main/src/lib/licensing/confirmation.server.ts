import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildConfirmation,
  confirmationConfiguration,
  deliverConfirmation,
  type ConfirmationConfiguration,
  type ConfirmationJob,
  type ConfirmationPayload,
} from "./confirmation";
import { getReceipt } from "./payments.server";
import type { Json } from "@/integrations/supabase/types";

async function prepare(
  job: ConfirmationJob,
  config: ConfirmationConfiguration,
): Promise<ConfirmationPayload> {
  const { data: order, error } = await supabaseAdmin
    .from("institutional_orders")
    .select("*")
    .eq("id", job.order_id)
    .single();
  if (error) throw new Error("confirmation_read_failed");
  const payload = buildConfirmation(
    await getReceipt(order),
    order.email_language,
    config.sender,
    config.recipient ?? undefined,
  );
  const { data, error: persistError } = await supabaseAdmin
    .from("institutional_confirmation_emails")
    .update({ payload: payload as unknown as Json })
    .eq("order_id", job.order_id)
    .eq("attempt_token", job.attempt_token ?? "")
    .eq("status", "sending")
    .select("order_id");
  if (persistError || data.length !== 1) throw new Error("confirmation_payload_failed");
  return payload;
}

export async function sendPurchaseConfirmations(orderId?: string, limit = 5) {
  // The owner-only sender is allowed solely with an explicit test recipient
  // and sandbox purchases. Production still requires a verified domain.
  const config = confirmationConfiguration(
    process.env["RESEND_FROM_EMAIL"],
    process.env["RESEND_TEST_RECIPIENT"],
  );
  const apiKey = process.env["RESEND_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!config || !apiKey || !lovableKey) return { ready: false, sent: 0 };
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    const outcome = await deliverConfirmation({
      claim: async () => {
        let wantedOrder = orderId;
        if (config.testing) {
          let candidates = supabaseAdmin
            .from("institutional_confirmation_emails")
            .select("order_id,institutional_orders!inner(environment)")
            .eq("institutional_orders.environment", "sandbox")
            .in("status", ["pending", "sending"])
            .lte("next_attempt_at", new Date().toISOString())
            .or(`lease_until.is.null,lease_until.lte.${new Date().toISOString()}`)
            .order("created_at")
            .limit(1);
          if (wantedOrder) candidates = candidates.eq("order_id", wantedOrder);
          const { data: eligible, error: eligibleError } = await candidates;
          if (eligibleError) throw new Error("confirmation_read_failed");
          wantedOrder = eligible[0]?.order_id;
          if (!wantedOrder) return null;
        }
        const { data, error } = await supabaseAdmin.rpc(
          "institutional_claim_confirmation",
          wantedOrder ? { wanted_order: wantedOrder } : {},
        );
        if (error) throw new Error("confirmation_claim_failed");
        return data[0] ?? null;
      },
      prepare: (job) => prepare(job, config),
      send: async (payload, key) => {
        // Revalidate persisted payloads too: an earlier attempt must never
        // bypass the test-only recipient or leak a live purchaser's receipt.
        if (
          config.testing &&
          (payload.from !== `EduPulse Intelligence <${config.sender}>` ||
            payload.to.length !== 1 ||
            payload.to[0] !== config.recipient)
        )
          throw new Error("testing_destination_mismatch");
        const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          signal: AbortSignal.timeout(12000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": apiKey,
            "Idempotency-Key": key,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          // Provider bodies can echo billing data; retain only non-sensitive
          // status and error name in application logs.
          const failure = (await response.json().catch(() => null)) as { name?: unknown } | null;
          const name =
            typeof failure?.name === "string" && /^[a-z_]+$/.test(failure.name)
              ? failure.name
              : "provider_error";
          console.error("Purchase confirmation rejected", { status: response.status, name });
          throw new Error("confirmation_delivery_failed");
        }
        const result = (await response.json()) as { id?: unknown };
        if (typeof result.id !== "string" || !result.id)
          throw new Error("confirmation_response_failed");
        return result.id;
      },
      finish: async (job, providerId, errorCode) => {
        const { data, error } = await supabaseAdmin.rpc("institutional_finish_confirmation", {
          wanted_order: job.order_id,
          wanted_token: job.attempt_token ?? "",
          ...(providerId ? { provider_id: providerId } : {}),
          ...(errorCode ? { error_code: errorCode } : {}),
        });
        if (error || !data) throw new Error("confirmation_acknowledgement_failed");
      },
    });
    if (outcome === "idle") break;
    if (outcome === "sent") sent++;
  }
  return { ready: true, sent };
}
