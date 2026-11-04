// Run against disposable accounts with EDU_PERMISSION_FIXTURE pointing to a private JSON fixture.
// No credentials are checked into the project. The test never uses privileged access.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

type Fixture = {
  url: string;
  key: string;
  studentId: string;
  schoolId: string;
  accounts: Record<"teacher" | "director" | "other", { id: string; token: string }>;
};
const path = process.env["EDU_PERMISSION_FIXTURE"];
const fixture: Fixture | null = path ? JSON.parse(readFileSync(path, "utf8")) : null;
async function request(
  role: keyof Fixture["accounts"] | null,
  endpoint: string,
  body?: unknown,
  method = "POST",
) {
  if (!fixture) throw new Error("Disposable fixture required");
  return fetch(`${fixture.url}/rest/v1/${endpoint}`, {
    method: body === undefined ? "GET" : method,
    headers: {
      apikey: fixture.key,
      ...(role ? { Authorization: `Bearer ${fixture.accounts[role].token}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe.skipIf(!fixture)("real educational permissions", () => {
  it("a teacher reads their persisted ALU-2041 metrics", async () => {
    const response = await request(
      "teacher",
      `students?id=eq.${fixture?.studentId}&select=code,attendance,submissions,resource_usage`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { code: "ALU-2041", attendance: 86, submissions: 65, resource_usage: 60 },
    ]);
  });
  it("a director cannot read individual students or observations", async () => {
    const response = await request("director", `students?id=eq.${fixture?.studentId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it("a director cannot read personalized intervention notes", async () => {
    const response = await request(
      "director",
      `intervention_plans?student_id=eq.${fixture?.studentId}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it("another school cannot read ALU-2041", async () => {
    const response = await request("other", `students?id=eq.${fixture?.studentId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it("a teacher cannot directly promote their protected role", async () => {
    const response = await request(
      "teacher",
      `user_roles?user_id=eq.${fixture?.accounts.teacher.id}`,
      { role: "director" },
      "PATCH",
    );
    if (response.ok) expect(await response.json()).toEqual([]);
    const read = await request(
      "teacher",
      `user_roles?user_id=eq.${fixture?.accounts.teacher.id}&select=role`,
    );
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual([{ role: "teacher" }]);
  });
  it("a teacher cannot issue school invitations", async () => {
    const response = await request("teacher", "rpc/edu_invite", {
      invite_email: "nobody@example.org",
      invite_role: "director",
    });
    expect(response.ok).toBe(false);
  });
  it("a teacher cannot change an existing role by creating another school", async () => {
    const response = await request("teacher", "rpc/edu_create_school", {
      school_name: "Forbidden duplicate",
      chosen_role: "director",
    });
    expect(response.ok).toBe(false);
  });
  it("plans require explicit human review even through direct writes", async () => {
    const payload = {
      student_id: fixture?.studentId,
      school_id: fixture?.schoolId,
      teacher_id: fixture?.accounts.teacher.id,
      support_action: "tutoring",
      priority: "high",
      notes: "Review enforcement check",
    };
    expect((await request("teacher", "intervention_plans", payload)).ok).toBe(false);
    expect(
      (await request("teacher", "intervention_plans", { ...payload, reviewed: false })).ok,
    ).toBe(false);
  });
  it("another school cannot attach a plan to ALU-2041", async () => {
    const response = await request("other", "intervention_plans", {
      student_id: fixture?.studentId,
      school_id: fixture?.schoolId,
      teacher_id: fixture?.accounts.other.id,
      support_action: "resources",
      priority: "high",
      notes: "Blocked foreign record",
      reviewed: true,
    });
    expect(response.ok).toBe(false);
  });
  it("director aggregates reflect actual retention, resources, history and completed plans", async () => {
    const response = await request("director", "rpc/edu_dashboard", {});
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      total: 1,
      retention: 100,
      attendance: 86,
      resources: 60,
      plans: 1,
      completedPlans: 1,
    });
    expect(data.trend.at(-1).attendance).toBe(86);
    expect(data.impact[0]).toMatchObject({ usage: "high", change: 14 });
    expect(JSON.stringify(data)).not.toContain("ALU-2041");
    expect(JSON.stringify(data)).not.toContain("Tutoría semanal");
  });
  it("anonymous callers cannot request private aggregate data", async () => {
    expect((await request(null, "rpc/edu_dashboard", {})).ok).toBe(false);
  });
});
