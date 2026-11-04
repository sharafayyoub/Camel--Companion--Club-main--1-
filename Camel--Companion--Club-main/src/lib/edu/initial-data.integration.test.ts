// Read the requested initial dataset under the user's own managed session.
// Enable with EDU_INITIAL_DATA_TEST=1; credentials are never printed or checked in.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { evaluateStudent } from "./alerts";

const enabled = process.env["EDU_INITIAL_DATA_TEST"] === "1";
function client(authenticated = true) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const session = JSON.parse(process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ?? "{}");
  if (!url || !key || (authenticated && !session.access_token))
    throw new Error("Managed test session required");
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: `initial-data-${crypto.randomUUID()}`,
    },
    global: {
      headers: authenticated ? { Authorization: `Bearer ${session.access_token}` } : {},
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}` && key.startsWith("sb_"))
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
describe.skipIf(!enabled)("requested initial Cloud records", () => {
  it.each([
    ["ALU-8102", "2º ESO", 71, 4.2, 12, "intermittent", "rojo"],
    ["ALU-4319", "2º ESO", 96, 7.8, 25, "low_none", "amarillo"],
    ["ALU-9025", "2º ESO", 94, 8.5, 88, "good", "verde"],
    ["ALU-3140", "3º ESO", 68, 4.8, 18, "intermittent", "rojo"],
    ["ALU-5521", "3º ESO", 89, 6.9, 60, "medium", "verde"],
  ])(
    "persists %s with the requested metrics and rule-derived level",
    async (code, course, attendance, grade, resources, connectivity, level) => {
      const { data, error } = await client().from("students").select("*").eq("code", code).single();
      expect(error).toBeNull();
      expect(data).toMatchObject({
        code,
        course,
        attendance,
        grade,
        resource_usage: resources,
        connectivity,
        is_sample: true,
      });
      if (!data) throw new Error("Seed student missing");
      expect(
        evaluateStudent({
          estudiante_id: data.code,
          grupo: data.course,
          asistencia: data.attendance,
          nota_media: data.grade,
          tareas_entregadas: data.submissions,
        }).level,
      ).toBe(level);
    },
  );
  it("has five students, one reviewed support plan and historical graph points", async () => {
    const { data, error } = await client().rpc("edu_dashboard");
    expect(error).toBeNull();
    expect(data).toMatchObject({
      total: 5,
      attendance: 83.6,
      resources: 40.6,
      plans: 1,
      completedPlans: 0,
    });
    const dashboard = data as { trend: unknown[]; groups: unknown[] };
    expect(dashboard.trend.length).toBeGreaterThanOrEqual(3);
    expect(dashboard.groups).toHaveLength(2);
  });
  it("persists the requested ALU-8102 teacher action and personalized notes in follow-up", async () => {
    const c = client();
    const student = await c.from("students").select("id").eq("code", "ALU-8102").single();
    if (!student.data) throw new Error("Seed student missing");
    const result = await c
      .from("intervention_plans")
      .select("action_detail,notes,status,reviewed,is_sample")
      .eq("student_id", student.data.id)
      .single();
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      action_detail:
        "Refuerzo individualizado presencial y préstamo de tablet con contenidos offline ProFuturo",
      notes: "Reunión con el tutor completada; se adapta material impreso para días de lluvia",
      status: "en_curso",
      reviewed: true,
      is_sample: true,
    });
  });
  it("keeps the pending ALU-4319 proposal unreviewed and rejects false or omitted confirmation", async () => {
    const c = client();
    const student = await c.from("students").select("id").eq("code", "ALU-4319").single();
    if (!student.data) throw new Error("Seed student missing");
    const proposal = await c
      .from("intervention_proposals")
      .select("*")
      .eq("student_id", student.data.id)
      .single();
    expect(proposal.error).toBeNull();
    if (!proposal.data) throw new Error("Seed proposal missing");
    expect(proposal.data.action_detail).toBe(
      "Flexibilización de entregas digitales y acceso a biblioteca/aula digital del centro",
    );
    const args = {
      wanted_proposal: proposal.data.id,
      chosen_action: "resources",
      chosen_priority: "medium",
      chosen_detail: proposal.data.action_detail,
      chosen_notes: "Test only; not reviewed",
    };
    expect(
      (await c.rpc("edu_validate_proposal", { ...args, confirmed_review: false })).error,
    ).not.toBeNull();
    expect(
      (
        await c.rpc("edu_validate_proposal", {
          ...args,
          confirmed_review: null as unknown as boolean,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await c.from("intervention_proposals").select("id").eq("id", proposal.data.id)).data,
    ).toHaveLength(1);
    expect(
      (await c.from("intervention_plans").select("id").eq("student_id", student.data.id)).data,
    ).toEqual([]);
  });
  it("keeps sample students and proposals private from anonymous visitors", async () => {
    expect((await client(false).from("students").select("id")).data).toEqual([]);
    const proposal = await client(false).from("intervention_proposals").select("id");
    expect(proposal.data ?? []).toEqual([]);
  });
});
