// Disposable Cloud fixtures. No real email is sent from this test.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
const enabled = process.env["INSTITUTIONAL_INTEGRATION_TEST"] === "1";
function clients() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const publicKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key || !publicKey) throw new Error("Integration credentials missing");
  const client = (value: string) =>
    createClient<Database>(url, value, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: `confirmation-test-${randomUUID()}`,
      },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (value.startsWith("sb_") && h.get("Authorization") === `Bearer ${value}`)
            h.delete("Authorization");
          h.set("apikey", value);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  return { admin: client(key), publicClient: client(publicKey) };
}
describe.skipIf(!enabled)("private purchase confirmation outbox", () => {
  it("denies public reads and email claims", async () => {
    const { publicClient } = clients();
    expect(
      (await publicClient.from("institutional_confirmation_emails").select("*")).error,
    ).not.toBeNull();
    expect((await publicClient.rpc("institutional_claim_confirmation", {})).error).not.toBeNull();
  });
  it("queues only after activation, once, with exclusive claims and durable delivery acknowledgement", async () => {
    const { admin } = clients();
    let orderId: string | null = null;
    try {
      const reservation = await admin.rpc("institutional_reserve", {
        wanted_package: "pilot",
        wanted_institution: `Confirmation fixture ${randomUUID()}`,
        wanted_email: "confirmation-fixture@example.org",
        wanted_mode: "solidarity",
        wanted_centres: [],
        wanted_count: 1,
        wanted_environment: "sandbox",
        wanted_request: randomUUID(),
        wanted_access_hash: "d".repeat(64),
      });
      expect(reservation.error).toBeNull();
      if (!reservation.data) throw new Error("Fixture reservation failed");
      orderId = reservation.data.id;
      expect(
        (await admin.from("institutional_confirmation_emails").select("*").eq("order_id", orderId))
          .data,
      ).toEqual([]);
      const session = `cs_test_confirmation_${randomUUID()}`;
      expect(
        (
          await admin
            .from("institutional_orders")
            .update({ status: "pending", stripe_session_id: session, email_language: "fr" })
            .eq("id", orderId)
        ).error,
      ).toBeNull();
      const verified = {
        wanted_order: orderId,
        wanted_session: session,
        verified_amount: 49000,
        verified_currency: "eur",
        verified_environment: "sandbox",
      };
      expect(
        (await admin.rpc("institutional_activate", { ...verified, verified_amount: 0 })).error,
      ).not.toBeNull();
      expect(
        (await admin.from("institutional_confirmation_emails").select("*").eq("order_id", orderId))
          .data,
      ).toEqual([]);
      const activated = await Promise.all([
        admin.rpc("institutional_activate", verified),
        admin.rpc("institutional_activate", verified),
      ]);
      expect(activated.every((result) => result.error === null)).toBe(true);
      const queued = await admin
        .from("institutional_confirmation_emails")
        .select("*")
        .eq("order_id", orderId);
      expect(queued.error).toBeNull();
      expect(queued.data).toHaveLength(1);
      expect(queued.data?.[0]?.license_id).toBe(activated[0]?.data);
      const claims = await Promise.all([
        admin.rpc("institutional_claim_confirmation", { wanted_order: orderId }),
        admin.rpc("institutional_claim_confirmation", { wanted_order: orderId }),
      ]);
      expect(claims.every((result) => result.error === null)).toBe(true);
      const claimed = claims.flatMap((result) => result.data ?? []);
      expect(claimed).toHaveLength(1);
      const token = claimed[0]?.attempt_token;
      if (!token) throw new Error("Claim token missing");
      expect(
        (
          await admin.rpc("institutional_finish_confirmation", {
            wanted_order: orderId,
            wanted_token: randomUUID(),
            provider_id: "fixture-email-id",
          })
        ).data,
      ).toBe(false);
      expect(
        (
          await admin.rpc("institutional_finish_confirmation", {
            wanted_order: orderId,
            wanted_token: token,
            provider_id: "fixture-email-id",
          })
        ).data,
      ).toBe(true);
      expect(
        (
          await admin
            .from("institutional_confirmation_emails")
            .select("status,provider_email_id,sent_at")
            .eq("order_id", orderId)
            .single()
        ).data,
      ).toMatchObject({ status: "sent", provider_email_id: "fixture-email-id" });
      expect(
        (await admin.rpc("institutional_claim_confirmation", { wanted_order: orderId })).data,
      ).toEqual([]);
    } finally {
      if (orderId) {
        expect(
          (await admin.from("institutional_licenses").delete().eq("order_id", orderId)).error,
        ).toBeNull();
        expect(
          (await admin.from("institutional_orders").delete().eq("id", orderId)).error,
        ).toBeNull();
      }
    }
  });
  it("holds ambiguous sends for review beyond the provider idempotency window", async () => {
    const { admin } = clients();
    let orderId: string | null = null;
    try {
      const reserved = await admin.rpc("institutional_reserve", {
        wanted_package: "pilot",
        wanted_institution: `Retry fixture ${randomUUID()}`,
        wanted_email: "retry-fixture@example.org",
        wanted_mode: "solidarity",
        wanted_centres: [],
        wanted_count: 1,
        wanted_environment: "sandbox",
        wanted_request: randomUUID(),
        wanted_access_hash: "e".repeat(64),
      });
      expect(reserved.error).toBeNull();
      if (!reserved.data) throw new Error("Fixture reservation failed");
      orderId = reserved.data.id;
      const session = `cs_test_retry_${randomUUID()}`;
      expect(
        (
          await admin
            .from("institutional_orders")
            .update({ status: "pending", stripe_session_id: session })
            .eq("id", orderId)
        ).error,
      ).toBeNull();
      expect(
        (
          await admin.rpc("institutional_activate", {
            wanted_order: orderId,
            wanted_session: session,
            verified_amount: 49000,
            verified_currency: "eur",
            verified_environment: "sandbox",
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await admin
            .from("institutional_confirmation_emails")
            .update({ first_attempt_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() })
            .eq("order_id", orderId)
        ).error,
      ).toBeNull();
      expect(
        (await admin.rpc("institutional_claim_confirmation", { wanted_order: orderId })).data,
      ).toEqual([]);
      expect(
        (
          await admin
            .from("institutional_confirmation_emails")
            .select("status")
            .eq("order_id", orderId)
            .single()
        ).data?.status,
      ).toBe("needs_review");
    } finally {
      if (orderId) {
        expect(
          (await admin.from("institutional_licenses").delete().eq("order_id", orderId)).error,
        ).toBeNull();
        expect(
          (await admin.from("institutional_orders").delete().eq("id", orderId)).error,
        ).toBeNull();
      }
    }
  });
});
