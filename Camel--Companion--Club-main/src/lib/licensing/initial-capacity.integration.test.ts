// Verify the requested initial snapshot; later real sandbox purchases change it.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
const enabled = process.env["INSTITUTIONAL_INITIAL_DATA_TEST"] === "1";
function client() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Private integration credentials required");
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: `initial-capacity-${crypto.randomUUID()}`,
    },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
describe.skipIf(!enabled)("initial institutional capacity snapshot", () => {
  it.each([
    ["pilot", 49000, 1, 9],
    ["district", 185000, 5, 4],
    ["regional", 450000, 15, 2],
  ])(
    "shows the requested %s price, coverage and remaining places",
    async (id, amount, max, available) => {
      const result = await client().rpc("institutional_availability", {
        wanted_environment: "sandbox",
      });
      expect(result.error).toBeNull();
      expect(result.data?.find((p) => p.id === id)).toMatchObject({
        amount_cents: amount,
        max_centres: max,
        available,
      });
    },
  );
  it("has no illustrative allocations in live inventory", async () => {
    const result = await client()
      .from("institutional_sample_allocations")
      .select("environment,centre_count");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ environment: "sandbox", centre_count: 1 }]);
  });
});
