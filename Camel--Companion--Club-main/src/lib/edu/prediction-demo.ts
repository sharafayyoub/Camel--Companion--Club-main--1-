/** Visual fixtures only. No inference or SHAP is performed by the application. */
export const DEMO_MODEL = {
  mode: "simulation",
  name: "Random Forest",
  version: "1.0",
  horizonMonths: 3,
  factors: [
    { key: "absences", weight: 42 },
    { key: "submissions", weight: 28 },
    { key: "resources", weight: 18 },
    { key: "connectivity", weight: 12 },
  ],
} as const;

const EXAMPLE_RISKS: Readonly<Record<string, number>> = {
  "ALU-8102": 78,
  "ALU-4319": 34,
  "ALU-9025": 8,
  "ALU-3140": 73,
  "ALU-5521": 19,
};

/** Never attach a simulated probability to a real student, even with a matching code. */
export function getDemoPrediction(student: { code: string; is_sample: boolean }) {
  const risk = student.is_sample ? EXAMPLE_RISKS[student.code] : undefined;
  if (risk === undefined) return null;
  return { ...DEMO_MODEL, risk, code: student.code };
}
