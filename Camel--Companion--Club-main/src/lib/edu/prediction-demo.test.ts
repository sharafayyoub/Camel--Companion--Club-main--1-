import { describe, expect, it } from "vitest";
import { DEMO_MODEL, getDemoPrediction } from "./prediction-demo";
import { findHandoffStudent, planHandoffSearch } from "./plan-handoff";

describe("explicit hackathon simulation", () => {
  it.each([
    ["ALU-8102", 78],
    ["ALU-4319", 34],
    ["ALU-9025", 8],
  ])("uses the supplied %s three-month example without inference", (code, risk) => {
    expect(getDemoPrediction({ code, is_sample: true })).toMatchObject({
      risk,
      horizonMonths: 3,
      mode: "simulation",
    });
  });
  it("does not fabricate evaluation or confidence metrics", () => {
    expect(DEMO_MODEL).not.toHaveProperty("precision");
    expect(DEMO_MODEL).not.toHaveProperty("recall");
    expect(DEMO_MODEL).not.toHaveProperty("confidence");
  });
  it("uses the four requested relative example contributions, not probability points", () => {
    expect(DEMO_MODEL.factors.map((factor) => factor.weight)).toEqual([42, 28, 18, 12]);
    expect(DEMO_MODEL.factors.reduce((sum, factor) => sum + factor.weight, 0)).toBe(100);
  });
  it("never generates probabilities for real or unknown students", () => {
    expect(getDemoPrediction({ code: "ALU-8102", is_sample: false })).toBeNull();
    expect(getDemoPrediction({ code: "ALU-OTHER", is_sample: true })).toBeNull();
  });
});
describe("human review handoff", () => {
  const studentId = "11111111-1111-4111-8111-111111111111";
  it("keeps only the selected student reference and simulation source, not predictions", () => {
    expect(
      planHandoffSearch.parse({ studentId, source: "predictionDemo", risk: 78, reviewed: true }),
    ).toEqual({ studentId, source: "predictionDemo" });
  });
  it("ignores malformed student links", () => {
    expect(planHandoffSearch.parse({ studentId: "not-an-id", source: "anything" })).toEqual({
      studentId: undefined,
      source: undefined,
    });
  });
  it("cannot select a student outside the caller's accessible records", () => {
    expect(
      findHandoffStudent([{ id: studentId }], "22222222-2222-4222-8222-222222222222"),
    ).toBeUndefined();
    expect(findHandoffStudent([{ id: studentId }], studentId)?.id).toBe(studentId);
  });
});
