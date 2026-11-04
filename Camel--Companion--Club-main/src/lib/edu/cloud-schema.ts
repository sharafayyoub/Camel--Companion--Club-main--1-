import { z } from "zod";

export const CONNECTIVITY = ["unknown", "low_none", "intermittent", "medium", "good"] as const;
const requiredNumber = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "number" || (typeof value === "string" && value.trim()) ? value : NaN,
    z.coerce.number().finite().min(0).max(maximum),
  );

export const studentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/),
  course: z.string().trim().min(1).max(80),
  attendance: requiredNumber(100),
  submissions: requiredNumber(100),
  resource_usage: requiredNumber(100),
  grade: requiredNumber(10),
  observations: z.string().max(3000),
  connectivity: z.enum(CONNECTIVITY).default("unknown"),
  enrollment_status: z.enum(["active", "completed", "withdrawn"]),
});
export type StudentInput = z.infer<typeof studentSchema>;
export const planSchema = z.object({
  student_id: z.string().uuid(),
  support_action: z.enum(["tutoring", "resources", "family", "mentoring"]),
  priority: z.enum(["low", "medium", "high"]),
  notes: z.string().trim().min(1).max(3000),
  action_detail: z.string().trim().max(3000).default(""),
  reviewed: z.literal(true),
});
export const SUPPORT_ACTIONS = ["tutoring", "resources", "family", "mentoring"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
export const STATUSES = ["pendiente", "en_curso", "completado", "descartado"] as const;

export type Dashboard = {
  privacySuppressed?: boolean;
  containsSamples?: boolean;
  total: number;
  active: number | null;
  withdrawn: number | null;
  completed: number | null;
  retention: number | null;
  attendance: number | null;
  grade: number | null;
  submissions: number | null;
  resources: number | null;
  priority: number | null;
  plans: number | null;
  completedPlans: number | null;
  groups: {
    grupo: string;
    total: number;
    asistencia: number;
    nota_media: number;
    tareas_entregadas: number;
    recursos: number;
  }[];
  trend: { day: string; attendance: number; grade: number }[];
  impact: {
    usage: "high" | "low";
    total: number;
    attendance: number;
    submissions: number;
    grade: number;
    change: number | null;
  }[];
};
