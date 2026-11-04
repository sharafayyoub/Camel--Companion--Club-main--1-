import { describe, it, expect } from "vitest";
import { planSchema, studentSchema } from "./cloud-schema";

const student = {
  code: "ALU-2041",
  course: "2ºB",
  attendance: 72,
  submissions: 65,
  resource_usage: 40,
  grade: 6,
  observations: "",
  connectivity: "unknown",
  enrollment_status: "active",
};
describe("pseudonymous student metrics", () => {
  it("accepts ALU-2041 and all requested metrics", () => {
    expect(studentSchema.parse(student)).toEqual(student);
  });
  it("rejects identifying free-text names as student codes", () => {
    expect(studentSchema.safeParse({ ...student, code: "María García" }).success).toBe(false);
  });
  it("limits attendance, submissions and resource usage to percentages", () => {
    for (const field of ["attendance", "submissions", "resource_usage"]) {
      expect(studentSchema.safeParse({ ...student, [field]: 101 }).success).toBe(false);
      expect(studentSchema.safeParse({ ...student, [field]: -1 }).success).toBe(false);
    }
  });
  it("rejects missing or nonfinite metrics instead of silently coercing them to zero", () => {
    for (const value of ["", " ", null, undefined, false, NaN, Infinity]) {
      expect(studentSchema.safeParse({ ...student, attendance: value }).success).toBe(false);
    }
    expect(studentSchema.safeParse({ ...student, attendance: 0 }).success).toBe(true);
  });
});
describe("human-in-the-loop intervention", () => {
  const plan = {
    student_id: "11111111-1111-4111-8111-111111111111",
    support_action: "tutoring",
    priority: "high",
    notes: "Repasar contenidos en tutoría",
    reviewed: true,
  };
  it("requires explicit professional review", () => {
    expect(planSchema.safeParse({ ...plan, reviewed: false }).success).toBe(false);
    expect(planSchema.parse(plan).reviewed).toBe(true);
  });
  it("requires a selected support action", () => {
    expect(planSchema.safeParse({ ...plan, support_action: "" }).success).toBe(false);
  });
  it("requires a selected priority", () => {
    expect(planSchema.safeParse({ ...plan, priority: "" }).success).toBe(false);
  });
  it("requires personalized notes", () => {
    expect(planSchema.safeParse({ ...plan, notes: " " }).success).toBe(false);
  });
});
