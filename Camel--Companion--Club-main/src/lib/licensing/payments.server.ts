import Stripe from "stripe";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Tables } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isVerifiedPayment, packageIdSchema, type Environment, type Receipt } from "./rules";

export type Order = Tables<"institutional_orders">;
export function paymentClient() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("unavailable");
  return {
    stripe: new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      timeout: 25000,
      maxNetworkRetries: 1,
    }),
    environment: (key.startsWith("sk_test_") || key.startsWith("rk_test_")
      ? "sandbox"
      : "live") as Environment,
  };
}
export const hashAccess = (value: string) => createHash("sha256").update(value).digest("hex");
export async function readOrder(id: string, token: string, environment: Environment) {
  const { data, error } = await supabaseAdmin
    .from("institutional_orders")
    .select("*")
    .eq("id", id)
    .eq("environment", environment)
    .maybeSingle();
  if (error || !data) throw new Error("invalid_receipt");
  const supplied = Buffer.from(hashAccess(token), "hex");
  const expected = Buffer.from(data.access_hash, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    throw new Error("invalid_receipt");
  return data;
}
export async function syncSession(order: Order, session: Stripe.Checkout.Session) {
  if (!isVerifiedPayment(order, session)) {
    if (session.payment_status === "paid") throw new Error("unavailable");
    if (session.id === order.stripe_session_id && session.status === "expired") {
      const { error } = await supabaseAdmin
        .from("institutional_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("status", "pending");
      if (error) throw new Error("unavailable");
    }
    return null;
  }
  const { data, error } = await supabaseAdmin.rpc("institutional_activate", {
    wanted_order: order.id,
    wanted_session: session.id,
    verified_amount: session.amount_subtotal ?? 0,
    verified_currency: session.currency ?? "",
    verified_environment: session.livemode ? "live" : "sandbox",
  });
  if (error) throw new Error("unavailable");
  // Activation atomically queues one confirmation; mail failure must never
  // turn a successful payment into a failed purchase.
  try {
    const { sendPurchaseConfirmations } = await import("./confirmation.server");
    await sendPurchaseConfirmations(order.id, 1);
  } catch {
    console.error("Purchase confirmation queued for retry");
  }
  return data;
}
export async function reconcile(stripe: Stripe, environment: Environment) {
  // Never release capacity by local time alone: Stripe is authoritative, even
  // when a buyer paid but closed the tab before returning.
  const pending: Order[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin
      .from("institutional_orders")
      .select("*")
      .eq("environment", environment)
      .in("status", ["preparing", "pending"])
      .order("created_at")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("unavailable");
    pending.push(...data);
    if (data.length < 1000) break;
  }
  const preparing = pending.filter((o) => !o.stripe_session_id);
  if (preparing.length) {
    const oldest = preparing[0];
    if (oldest) {
      // Stripe's async iterator auto-paginates; limit is PAGE size, not a cap.
      const sessions = stripe.checkout.sessions.list({
        created: {
          gte: Math.floor(new Date(oldest.created_at).getTime() / 1000) - 5,
          lte: Math.floor(Date.now() / 1000),
        },
        limit: 100,
      });
      const found = new Map<string, Stripe.Checkout.Session>();
      for await (const session of sessions) {
        const id = session.metadata?.["institutional_order_id"];
        if (id && preparing.some((o) => o.id === id)) found.set(id, session);
      }
      for (const order of preparing) {
        const session = found.get(order.id);
        if (session) {
          if (
            session.client_reference_id !== order.id ||
            session.amount_subtotal !== order.amount_cents ||
            session.currency !== order.currency ||
            session.livemode !== (environment === "live")
          )
            throw new Error("unavailable");
          const { error: bindError } = await supabaseAdmin
            .from("institutional_orders")
            .update({
              stripe_session_id: session.id,
              stripe_expires_at: new Date(session.expires_at * 1000).toISOString(),
              status: "pending",
            })
            .eq("id", order.id)
            .eq("status", "preparing");
          if (bindError) throw new Error("unavailable");
          await syncSession(
            { ...order, stripe_session_id: session.id, status: "pending" },
            session,
          );
        } else if (Date.now() - new Date(order.created_at).getTime() > 45 * 60 * 1000) {
          // Complete Stripe enumeration found no session, and the immutable
          // forty-minute create window has passed. Unknown states fail closed.
          const { error: releaseError } = await supabaseAdmin
            .from("institutional_orders")
            .update({ status: "cancelled" })
            .eq("id", order.id)
            .eq("status", "preparing");
          if (releaseError) throw new Error("unavailable");
        }
      }
    }
  }
  await Promise.all(
    pending
      .filter((o) => o.stripe_session_id)
      .map(async (order) => {
        if (!order.stripe_session_id) return;
        await syncSession(order, await stripe.checkout.sessions.retrieve(order.stripe_session_id));
      }),
  );
}
export async function getReceipt(order: Order): Promise<Receipt> {
  const { data: fresh, error } = await supabaseAdmin
    .from("institutional_orders")
    .select("*")
    .eq("id", order.id)
    .single();
  if (error) throw new Error("unavailable");
  const { data: license, error: licenceError } = await supabaseAdmin
    .from("institutional_licenses")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();
  if (licenceError) throw new Error("unavailable");
  return {
    status: fresh.status as Receipt["status"],
    institution_name: fresh.institution_name,
    billing_email: fresh.billing_email,
    package_id: packageIdSchema.parse(fresh.package_id),
    centre_count: fresh.centre_count,
    centres: Array.isArray(fresh.centres)
      ? fresh.centres.filter((v): v is string => typeof v === "string")
      : [],
    beneficiary_mode: fresh.beneficiary_mode as Receipt["beneficiary_mode"],
    amount_cents: fresh.amount_cents,
    environment: fresh.environment as Environment,
    paid_at: fresh.paid_at,
    license_id: license?.id ?? null,
  };
}
