import { z } from "zod";

export const INTERVENTIONS = ["tutoring", "resources", "family", "mentoring"] as const;
export type Intervention = (typeof INTERVENTIONS)[number];
export const METRICS = ["attendance", "grade", "submissions"] as const;
export type ImpactMetrics = { attendance: number; grade: number; submissions: number };
export const MIN_COHORT = 5;

// No effect size is assigned to an intervention. Targets are chosen by the teacher.
export const INTERVENTION_WEEKS: Record<Intervention, number> = {
  tutoring: 6,
  resources: 4,
  family: 4,
  mentoring: 8,
};
const numeric = (max: number) => z.number().finite().min(0).max(max);
export const impactMetricsSchema = z.object({
  attendance: numeric(100),
  grade: numeric(10),
  submissions: numeric(100),
});
export const impactDesignSchema = z.object({
  student_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  actions: z
    .array(z.enum(INTERVENTIONS))
    .min(1)
    .max(4)
    .refine((items) => new Set(items).size === items.length),
  duration_weeks: z.number().int().min(1).max(52),
  priority: z.enum(["low", "medium", "high"]),
  objective: z.string().trim().min(3).max(3000),
  notes: z.string().trim().min(1).max(3000),
  reviewed: z.literal(true),
});
export type ImpactDesign = z.infer<typeof impactDesignSchema>;

export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (day) =>
      Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
      new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day,
  );

export function followupSchema(baselineDay: string, today = utcDay()) {
  return impactMetricsSchema.extend({
    observed_on: daySchema.refine((day) => day >= baselineDay && day <= today),
    notes: z.string().trim().min(1).max(3000),
  });
}
export type ImpactFollowupInput = z.infer<ReturnType<typeof followupSchema>>;

export function observedChange(before: ImpactMetrics, after: ImpactMetrics): ImpactMetrics {
  impactMetricsSchema.parse(before);
  impactMetricsSchema.parse(after);
  const difference = (key: keyof ImpactMetrics) => Math.round((after[key] - before[key]) * 10) / 10;
  return {
    attendance: difference("attendance"),
    grade: difference("grade"),
    submissions: difference("submissions"),
  };
}

export function illustrativeScenario(baseline: ImpactMetrics, target: ImpactMetrics) {
  impactMetricsSchema.parse(baseline);
  impactMetricsSchema.parse(target);
  return {
    kind: "illustrative" as const,
    baseline,
    target,
    change: observedChange(baseline, target),
  };
}

export type ImpactStudy = {
  plan_id: string;
  actions: Intervention[];
  duration_weeks: number;
  baseline_attendance: number;
  baseline_grade: number;
  baseline_submissions: number;
  baseline_on: string;
  created_at: string;
};
export type ImpactFollowup = ImpactMetrics & {
  id: string;
  plan_id: string;
  observed_on: string;
  notes: string;
  created_at: string;
};
export type ImpactAggregate = {
  action: Intervention;
  students: number;
  attendance_change: number;
  grade_change: number;
  submissions_change: number;
};
export function baselineMetrics(study: ImpactStudy): ImpactMetrics {
  return {
    attendance: study.baseline_attendance,
    grade: study.baseline_grade,
    submissions: study.baseline_submissions,
  };
}

// Mirrors the database release rule for the public, entirely fictional demonstration.
// One latest measured plan per student; no student codes or free text in released data.
export function aggregateExperiences(
  records: {
    student_id: string;
    action: Intervention;
    baseline: ImpactMetrics;
    followup: ImpactMetrics;
    observed_on: string;
    is_sample: boolean;
  }[],
  includeDemo = false,
): ImpactAggregate[] {
  const latest = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.is_sample && !includeDemo) continue;
    const previous = latest.get(record.student_id);
    if (!previous || record.observed_on > previous.observed_on)
      latest.set(record.student_id, record);
  }
  return INTERVENTIONS.flatMap((action) => {
    const group = [...latest.values()].filter((record) => record.action === action);
    if (group.length < MIN_COHORT) return [];
    const changes = group.map((record) => observedChange(record.baseline, record.followup));
    const average = (key: keyof ImpactMetrics) =>
      Math.round((changes.reduce((sum, change) => sum + change[key], 0) / group.length) * 10) / 10;
    return [
      {
        action,
        students: group.length,
        attendance_change: average("attendance"),
        grade_change: average("grade"),
        submissions_change: average("submissions"),
      },
    ];
  });
}
