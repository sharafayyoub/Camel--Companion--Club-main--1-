// Opt-in real Cloud checks. All writes are disposable sandbox fixtures and are
// removed in finally blocks; no private key is stored in source or output.
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
        storageKey: `institutional-test-${randomUUID()}`,
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
describe.skipIf(!enabled)("institutional Cloud capacity", () => {
  it.each([
    ["pilot", 49000, 1, 10],
    ["district", 185000, 5, 5],
    ["regional", 450000, 15, 2],
  ])(
    "persists the user-specified %s amount and centre limits",
    async (id, amount, max, capacity) => {
      const { admin } = clients();
      const { data, error } = await admin.rpc("institutional_package_catalog");
      expect(error).toBeNull();
      expect(data?.find((p) => p.id === id)).toEqual({
        id,
        amount_cents: amount,
        max_centres: max,
        capacity,
      });
    },
  );
  it("denies public billing reads and direct reservation writes", async () => {
    const { publicClient } = clients();
    expect(
      (await publicClient.from("institutional_orders").select("billing_email")).error,
    ).not.toBeNull();
    expect(
      (await publicClient.from("institutional_licenses").select("billing_email")).error,
    ).not.toBeNull();
    expect(
      (
        await publicClient.rpc("institutional_reserve", {
          wanted_package: "pilot",
          wanted_institution: "Forbidden",
          wanted_email: "forbidden@example.org",
          wanted_mode: "solidarity",
          wanted_centres: [],
          wanted_count: 1,
          wanted_environment: "sandbox",
          wanted_request: randomUUID(),
          wanted_access_hash: "a".repeat(64),
        })
      ).error,
    ).not.toBeNull();
  });
  it("atomically reserves one place per centre and prevents concurrent overselling", async () => {
    const { admin } = clients();
    const marker = `Capacity fixture ${randomUUID()}`;
    const before = await admin.rpc("institutional_availability", { wanted_environment: "sandbox" });
    const available = before.data?.find((p) => p.id === "district")?.available;
    if (available === undefined || available < 1)
      throw new Error("Sandbox district inventory unavailable for capacity test");
    const liveBefore = await admin.rpc("institutional_availability", {
      wanted_environment: "live",
    });
    try {
      const results = await Promise.all(
        Array.from({ length: available + 1 }, () =>
          admin.rpc("institutional_reserve", {
            wanted_package: "district",
            wanted_institution: marker,
            wanted_email: "capacity-fixture@example.org",
            wanted_mode: "solidarity",
            wanted_centres: [],
            wanted_count: 1,
            wanted_environment: "sandbox",
            wanted_request: randomUUID(),
            wanted_access_hash: "b".repeat(64),
          }),
        ),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(available);
      expect(results.filter((r) => r.error?.message.includes("sold_out"))).toHaveLength(1);
      const after = await admin.rpc("institutional_availability", {
        wanted_environment: "sandbox",
      });
      expect(after.data?.find((p) => p.id === "district")?.available).toBe(0);
      const live = await admin.rpc("institutional_availability", { wanted_environment: "live" });
      expect(live.data?.find((p) => p.id === "district")?.available).toBe(
        liveBefore.data?.find((p) => p.id === "district")?.available,
      );
    } finally {
      expect(
        (
          await admin
            .from("institutional_orders")
            .delete()
            .eq("institution_name", marker)
            .eq("environment", "sandbox")
        ).error,
      ).toBeNull();
    }
  });
  it("repeated activation records a single licence and consumes two regional centre places", async () => {
    const { admin } = clients();
    const marker = `Activation fixture ${randomUUID()}`;
    const request = randomUUID();
    let orderId: string | null = null;
    try {
      const args = {
        wanted_package: "regional",
        wanted_institution: marker,
        wanted_email: "activation-fixture@example.org",
        wanted_mode: "direct",
        wanted_centres: ["Fixture centre one", "Fixture centre two"],
        wanted_count: 2,
        wanted_environment: "sandbox",
        wanted_request: request,
        wanted_access_hash: "c".repeat(64),
      };
      const reserved = await admin.rpc("institutional_reserve", args);
      expect(reserved.error).toBeNull();
      if (!reserved.data) throw new Error("Fixture reservation failed");
      orderId = reserved.data.id;
      expect((await admin.rpc("institutional_reserve", args)).data?.id).toBe(orderId);
      const session = `cs_test_fixture_${randomUUID()}`;
      expect(
        (
          await admin
            .from("institutional_orders")
            .update({ stripe_session_id: session, status: "pending" })
            .eq("id", orderId)
        ).error,
      ).toBeNull();
      const verified = {
        wanted_order: orderId,
        wanted_session: session,
        verified_amount: 450000,
        verified_currency: "eur",
        verified_environment: "sandbox",
      };
      expect(
        (await admin.rpc("institutional_activate", { ...verified, verified_amount: 1 })).error,
      ).not.toBeNull();
      const activated = await Promise.all([
        admin.rpc("institutional_activate", verified),
        admin.rpc("institutional_activate", verified),
      ]);
      expect(activated[0].error).toBeNull();
      expect(activated[1].error).toBeNull();
      expect(activated[0].data).toBe(activated[1].data);
      const licenses = await admin
        .from("institutional_licenses")
        .select("*")
        .eq("order_id", orderId);
      expect(licenses.data).toHaveLength(1);
      expect(licenses.data?.[0]).toMatchObject({
        institution_name: marker,
        billing_email: "activation-fixture@example.org",
        package_id: "regional",
        centre_count: 2,
        centres: args.wanted_centres,
        status: "active",
        assignment_status: "designated",
      });
      expect(licenses.data?.[0]?.activated_at).toBeTruthy();
      const remaining = await admin.rpc("institutional_availability", {
        wanted_environment: "sandbox",
      });
      expect(remaining.data?.find((p) => p.id === "regional")?.available).toBe(0);
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
