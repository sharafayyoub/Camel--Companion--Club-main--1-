import { describe, expect, it } from "vitest";
import {
  aggregateExperiences,
  daySchema,
  followupSchema,
  illustrativeScenario,
  impactDesignSchema,
  observedChange,
} from "./impact";

const baseline = { attendance: 71, grade: 4.2, submissions: 52 };
const after = { attendance: 82, grade: 5.4, submissions: 68 };
const design = {
  student_id: "81020000-0000-4000-8000-000000000001",
  plan_id: null,
  actions: ["tutoring", "resources"],
  duration_weeks: 6,
  priority: "high",
  objective: "Tutoría semanal y acceso a contenidos",
  notes: "Revisado con el equipo docente",
  reviewed: true,
};
describe("responsible scenario exploration", () => {
  it("requires explicit review and at least one support, rejecting duplicate or unknown supports", () => {
    expect(impactDesignSchema.safeParse(design).success).toBe(true);
    for (const patch of [
      { reviewed: false },
      { reviewed: undefined },
      { actions: [] },
      { actions: ["tutoring", "tutoring"] },
      { actions: ["automatic-sanction"] },
      { duration_weeks: 0 },
      { duration_weeks: 53 },
      { notes: " " },
    ]) {
      expect(impactDesignSchema.safeParse({ ...design, ...patch }).success).toBe(false);
    }
  });
  it("makes hypothetical targets explicit, with no model or causal estimate", () => {
    const result = illustrativeScenario(baseline, after);
    expect(result.kind).toBe("illustrative");
    expect(result.change).toEqual({ attendance: 11, grade: 1.2, submissions: 16 });
    expect(baseline.attendance).toBe(71);
    expect(result).not.toHaveProperty("probability");
  });
  it("measures declines and zero values without relative-percent or division errors", () => {
    expect(observedChange(after, baseline)).toEqual({
      attendance: -11,
      grade: -1.2,
      submissions: -16,
    });
    expect(observedChange({ attendance: 0, grade: 0, submissions: 0 }, after)).toEqual(after);
    expect(() => illustrativeScenario(baseline, { ...after, grade: 11 })).toThrow();
  });
});
describe("recorded evidence", () => {
  const schema = followupSchema("2026-10-07", "2026-11-04");
  const record = {
    ...after,
    observed_on: "2026-11-04",
    notes: "Indicadores revisados al cierre de octubre",
  };
  it("accepts only complete, bounded observations with valid nonfuture dates", () => {
    expect(schema.safeParse(record).success).toBe(true);
    for (const patch of [
      { observed_on: "2026-10-06" },
      { observed_on: "2026-11-05" },
      { observed_on: "2026-02-30" },
      { attendance: NaN },
      { submissions: "" },
      { grade: Infinity },
      { notes: "" },
    ]) {
      expect(schema.safeParse({ ...record, ...patch }).success).toBe(false);
    }
    expect(daySchema.safeParse("2024-02-29").success).toBe(true);
    expect(daySchema.safeParse("2025-02-29").success).toBe(false);
  });
});
describe("privacy-preserving institutional experience", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      student_id: `private-${i}`,
      action: "tutoring" as const,
      baseline,
      followup: after,
      observed_on: "2026-11-04",
      is_sample: false,
    }));
  it("suppresses cohorts below five distinct students", () => {
    expect(aggregateExperiences(rows(4))).toEqual([]);
    expect(
      aggregateExperiences([...rows(1), ...rows(1), ...rows(1), ...rows(1), ...rows(1)]),
    ).toEqual([]);
  });
  it("includes exactly one latest evaluation per student, without codes or notes", () => {
    const old = { ...rows(1)[0]!, followup: baseline, observed_on: "2026-10-08" };
    expect(aggregateExperiences([old, ...rows(5)])).toEqual([
      {
        action: "tutoring",
        students: 5,
        attendance_change: 11,
        grade_change: 1.2,
        submissions_change: 16,
      },
    ]);
    expect(JSON.stringify(aggregateExperiences(rows(5)))).not.toContain("private-");
  });
  it("excludes samples unless the separate fictional demo explicitly requests them", () => {
    const samples = rows(5).map((r) => ({ ...r, is_sample: true }));
    expect(aggregateExperiences(samples)).toEqual([]);
    expect(aggregateExperiences(samples, true)).toHaveLength(1);
  });
  it("never mixes different support cohorts to reach the release threshold", () => {
    expect(
      aggregateExperiences([...rows(4), { ...rows(1)[0]!, student_id: "other", action: "family" }]),
    ).toEqual([]);
  });
});
