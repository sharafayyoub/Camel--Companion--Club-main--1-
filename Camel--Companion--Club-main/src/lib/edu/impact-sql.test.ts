// @vitest-environment node
// Real PostgreSQL (WASM), isolated in memory. Auth and realtime infrastructure are stubs.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

let db: PGlite;
const teacher = "10000000-0000-4000-8000-000000000001";
const director = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const sameSchoolTeacher = "10000000-0000-4000-8000-000000000004";
const school = "20000000-0000-4000-8000-000000000001";
const foreignSchool = "20000000-0000-4000-8000-000000000002";
let student: string;
let plan: string;
async function asUser(id: string | null, sql: string, args: unknown[] = []) {
  await db.exec(id ? "SET ROLE authenticated" : "SET ROLE anon");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? ""]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("RESET ROLE");
  }
}
async function newStudent(code: string, isSample = false) {
  const result = await asUser(
    teacher,
    "INSERT INTO public.students(school_id,teacher_id,code,course,attendance,grade,submissions,resource_usage,is_sample) VALUES($1,$2,$3,'2A',71,4.2,52,12,$4) RETURNING id",
    [school, teacher, code, isSample],
  );
  return (result.rows[0] as { id: string }).id;
}
const saveSql = "SELECT public.edu_save_impact_plan($1,$2,$3,$4,$5,$6,$7,$8) AS id";
function saveArgs(id: string, planId: string | null = null, review: unknown = true) {
  return [
    id,
    planId,
    ["tutoring", "resources"],
    6,
    "high",
    "Objetivo docente revisado",
    "Notas sintéticas de prueba",
    review,
  ];
}
const followSql =
  "SELECT public.edu_record_impact($1,current_date,82,5.4,68,'Observación ficticia de prueba')";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;
    CREATE SCHEMA realtime; CREATE TABLE realtime.messages(id bigint,topic text);
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT ''::text $$;
    CREATE FUNCTION realtime.send(jsonb,text,text,boolean) RETURNS void LANGUAGE sql AS $$ SELECT $$;
    GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;`);
  const directory = path.resolve("drizzle/migrations");
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(path.join(directory, file), "utf8"));
  }
  await db.query(
    "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'teacher@example.test',now()),($2,'director@example.test',now()),($3,'other@example.test',now()),($4,'colleague@example.test',now())",
    [teacher, director, other, sameSchoolTeacher],
  );
  await db.query(
    "INSERT INTO public.schools(id,name,created_by) VALUES($1,'Synthetic school',$2),($3,'Other synthetic school',$4)",
    [school, teacher, foreignSchool, other],
  );
  await db.query(
    "INSERT INTO public.user_roles(user_id,school_id,role) VALUES($1,$2,'teacher'),($3,$2,'director'),($4,$5,'teacher'),($6,$2,'teacher')",
    [teacher, school, director, other, foreignSchool, sameSchoolTeacher],
  );
  student = await newStudent("ALU-TEST-01");
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe.sequential("Impact Lab database authorization and evidence", () => {
  it("applies every migration and requires explicit review even through direct RPCs", async () => {
    await expect(asUser(teacher, saveSql, saveArgs(student, null, false))).rejects.toThrow(
      "review_required",
    );
    await expect(asUser(teacher, saveSql, saveArgs(student, null, null))).rejects.toThrow(
      "review_required",
    );
    await expect(
      asUser(teacher, saveSql, [
        student,
        null,
        ["tutoring", "tutoring"],
        6,
        "high",
        "Objective",
        "Notes",
        true,
      ]),
    ).rejects.toThrow("invalid_design");
    await expect(
      asUser(teacher, saveSql, [student, null, [null], 6, "high", "Objective", "Notes", true]),
    ).rejects.toThrow("invalid_design");
  });
  it("atomically creates one existing-system plan and a baseline; attaches without duplication", async () => {
    const result = await asUser(teacher, saveSql, saveArgs(student));
    plan = (result.rows[0] as { id: string }).id;
    await asUser(teacher, saveSql, saveArgs(student, plan));
    const counts = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.intervention_plans WHERE student_id=$1",
      [student],
    );
    expect(counts.rows[0]?.count).toBe(1);
    const snapshot = await asUser(teacher, "SELECT * FROM public.impact_studies WHERE plan_id=$1", [
      plan,
    ]);
    expect(snapshot.rows[0]).toMatchObject({
      baseline_attendance: "71",
      baseline_grade: "4.2",
      baseline_submissions: "52",
      actions: ["tutoring", "resources"],
    });
  });
  it("does not permit anonymous users, directors, other schools or same-school colleagues to create plans or read individual evidence", async () => {
    for (const id of [director, other, sameSchoolTeacher, null]) {
      await expect(asUser(id, saveSql, saveArgs(student))).rejects.toThrow();
      if (id) {
        expect((await asUser(id, "SELECT * FROM public.impact_studies")).rows).toEqual([]);
        expect((await asUser(id, "SELECT * FROM public.impact_followups")).rows).toEqual([]);
      } else await expect(asUser(id, "SELECT * FROM public.impact_studies")).rejects.toThrow();
    }
  });
  it("blocks forged baselines and direct insert/update/delete of observations", async () => {
    await expect(
      asUser(teacher, "UPDATE public.impact_studies SET baseline_grade=10 WHERE plan_id=$1", [
        plan,
      ]),
    ).rejects.toThrow();
    await expect(
      asUser(
        teacher,
        "INSERT INTO public.impact_followups(plan_id,observed_on,attendance,grade,submissions,notes) VALUES($1,current_date,99,10,100,'forged')",
        [plan],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(teacher, "DELETE FROM public.impact_followups WHERE plan_id=$1", [plan]),
    ).rejects.toThrow();
  });
  it("appends genuine teacher input, rejects duplicates/future dates, and never changes student metrics", async () => {
    await asUser(teacher, followSql, [plan]);
    await expect(asUser(teacher, followSql, [plan])).rejects.toThrow();
    await expect(
      asUser(teacher, "SELECT public.edu_record_impact($1,current_date+1,82,5.4,68,'future')", [
        plan,
      ]),
    ).rejects.toThrow("invalid_date");
    for (const id of [director, other, sameSchoolTeacher])
      await expect(asUser(id, followSql, [plan])).rejects.toThrow();
    const original = await asUser(
      teacher,
      "SELECT attendance,grade FROM public.students WHERE id=$1",
      [student],
    );
    expect(original.rows[0]).toMatchObject({ attendance: "71", grade: "4.2" });
  });
  it("retains its baseline when metrics or the design change; prevents moving evidence to another student", async () => {
    await asUser(teacher, "UPDATE public.students SET attendance=90 WHERE id=$1", [student]);
    await asUser(teacher, saveSql, saveArgs(student, plan));
    expect(
      (
        await asUser(
          teacher,
          "SELECT baseline_attendance FROM public.impact_studies WHERE plan_id=$1",
          [plan],
        )
      ).rows[0],
    ).toMatchObject({ baseline_attendance: "71" });
    const second = await newStudent("ALU-TEST-02");
    await expect(
      asUser(teacher, "UPDATE public.intervention_plans SET student_id=$1 WHERE id=$2", [
        second,
        plan,
      ]),
    ).rejects.toThrow("immutable_impact_owner");
  });
  it("hides small institutional cohorts and the legacy director dashboard, including sample-only schools", async () => {
    expect(
      (await asUser(director, "SELECT public.edu_impact_summary() AS result")).rows[0],
    ).toMatchObject({ result: [] });
    expect(
      (await asUser(director, "SELECT public.edu_dashboard() AS result")).rows[0],
    ).toMatchObject({ result: { privacySuppressed: true, attendance: null, groups: [] } });
  });
  it("releases a cohort only at five distinct real students, never includes samples or personal notes", async () => {
    for (let i = 0; i < 4; i++) {
      const id = await newStudent(`ALU-COHORT-${i}`);
      const created = await asUser(teacher, saveSql, saveArgs(id));
      await asUser(teacher, followSql, [(created.rows[0] as { id: string }).id]);
    }
    const sample = await newStudent("ALU-SAMPLE-01", true);
    const samplePlan = await asUser(teacher, saveSql, saveArgs(sample));
    await asUser(teacher, followSql, [(samplePlan.rows[0] as { id: string }).id]);
    await expect(
      asUser(teacher, "UPDATE public.students SET is_sample=false WHERE id=$1", [sample]),
    ).rejects.toThrow("sample_provenance_immutable");
    const released = await asUser(director, "SELECT public.edu_impact_summary() AS result");
    expect(released.rows[0]).toMatchObject({
      result: [
        {
          action: "tutoring",
          students: 5,
          attendance_change: 11,
          grade_change: 1.2,
          submissions_change: 16,
        },
      ],
    });
    expect(JSON.stringify(released.rows)).not.toContain("Notas");
    expect(JSON.stringify(released.rows)).not.toContain(student);
    await expect(asUser(null, "SELECT public.edu_impact_summary() AS result")).rejects.toThrow();
  });
  it("does not allow multiple plans for one student to inflate the cohort", async () => {
    const created = await asUser(teacher, saveSql, saveArgs(student));
    await asUser(teacher, followSql, [(created.rows[0] as { id: string }).id]);
    expect(
      (await asUser(director, "SELECT public.edu_impact_summary() AS result")).rows[0],
    ).toMatchObject({ result: [{ students: 5 }] });
  });
});

describe.sequential("institutional licensing SQL without external payments", () => {
  let orderId: string;
  const requestId = "30000000-0000-4000-8000-000000000001";
  async function service(sql: string, args: unknown[] = []) {
    await db.exec("SET ROLE service_role");
    try {
      return await db.query(sql, args);
    } finally {
      await db.exec("RESET ROLE");
    }
  }
  const reserveSql =
    "SELECT (public.institutional_reserve('pilot','Synthetic foundation','billing@example.test','solidarity','[]'::jsonb,1,'sandbox',$1,$2)).*";
  it("keeps guest orders, licenses and confirmation claims private", async () => {
    for (const id of [teacher, director, null]) {
      await expect(asUser(id, reserveSql, [requestId, "a".repeat(64)])).rejects.toThrow();
      await expect(
        asUser(id, "SELECT * FROM public.institutional_confirmation_emails"),
      ).rejects.toThrow();
      await expect(
        asUser(id, "SELECT public.institutional_claim_confirmation(NULL)"),
      ).rejects.toThrow();
    }
  });
  it("uses the authoritative package price and idempotently reserves once", async () => {
    const first = await service(reserveSql, [requestId, "a".repeat(64)]);
    const repeated = await service(reserveSql, [requestId, "a".repeat(64)]);
    orderId = (first.rows[0] as { id: string }).id;
    expect(repeated.rows[0]).toMatchObject({
      id: orderId,
      amount_cents: 49000,
      status: "preparing",
    });
    await expect(service(reserveSql, [requestId, "b".repeat(64)])).rejects.toThrow("invalid_order");
    const capacity = await service(
      "SELECT available FROM public.institutional_availability('sandbox') WHERE id='pilot'",
    );
    expect(capacity.rows[0]).toMatchObject({ available: 9 });
    expect((await service("SELECT * FROM public.institutional_confirmation_emails")).rows).toEqual(
      [],
    );
  });
  it("requires verified session, amount and environment before activation", async () => {
    await service(
      "UPDATE public.institutional_orders SET stripe_session_id='cs_test_synthetic',status='pending' WHERE id=$1",
      [orderId],
    );
    for (const [session, amount, environment] of [
      ["wrong", 49000, "sandbox"],
      ["cs_test_synthetic", 1, "sandbox"],
      ["cs_test_synthetic", 49000, "live"],
    ]) {
      await expect(
        service("SELECT public.institutional_activate($1,$2,$3,'eur',$4)", [
          orderId,
          session,
          amount,
          environment,
        ]),
      ).rejects.toThrow("invalid_payment");
    }
    await expect(
      asUser(
        teacher,
        "SELECT public.institutional_activate($1,'cs_test_synthetic',49000,'eur','sandbox')",
        [orderId],
      ),
    ).rejects.toThrow();
  });
  it("creates exactly one solidarity license and one queued confirmation on repeated verified activation", async () => {
    await service(
      "SELECT public.institutional_activate($1,'cs_test_synthetic',49000,'eur','sandbox')",
      [orderId],
    );
    await service(
      "SELECT public.institutional_activate($1,'cs_test_synthetic',49000,'eur','sandbox')",
      [orderId],
    );
    expect(
      (
        await service(
          "SELECT assignment_status FROM public.institutional_licenses WHERE order_id=$1",
          [orderId],
        )
      ).rows,
    ).toEqual([{ assignment_status: "awaiting_solidarity_assignment" }]);
    expect(
      (
        await service(
          "SELECT status FROM public.institutional_confirmation_emails WHERE order_id=$1",
          [orderId],
        )
      ).rows,
    ).toEqual([{ status: "pending" }]);
    expect(
      (
        await service(
          "SELECT available FROM public.institutional_availability('sandbox') WHERE id='pilot'",
        )
      ).rows,
    ).toEqual([{ available: 9 }]);
  });
  it("isolates sandbox/live inventory and prevents reserving more centers than capacity", async () => {
    expect(
      (
        await service(
          "SELECT available FROM public.institutional_availability('live') WHERE id='pilot'",
        )
      ).rows,
    ).toEqual([{ available: 10 }]);
    for (let i = 0; i < 9; i++) await service(reserveSql, [crypto.randomUUID(), "c".repeat(64)]);
    await expect(service(reserveSql, [crypto.randomUUID(), "c".repeat(64)])).rejects.toThrow(
      "sold_out",
    );
    expect(
      (
        await service(
          "SELECT available FROM public.institutional_availability('sandbox') WHERE id='pilot'",
        )
      ).rows,
    ).toEqual([{ available: 0 }]);
  });
});
