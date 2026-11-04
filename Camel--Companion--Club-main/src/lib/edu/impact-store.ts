import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  impactDesignSchema,
  type ImpactAggregate,
  type ImpactDesign,
  type ImpactStudy,
  type ImpactFollowup,
  type ImpactFollowupInput,
} from "./impact";

// Additive contract for migration 0009; keeps the Cloud-generated base file intact.
type ReadTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type ImpactDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      impact_studies: ReadTable<ImpactStudy>;
      impact_followups: ReadTable<ImpactFollowup>;
    };
    Functions: Database["public"]["Functions"] & {
      edu_save_impact_plan: {
        Args: {
          wanted_student: string;
          wanted_plan: string | null;
          chosen_actions: string[];
          chosen_weeks: number;
          chosen_priority: string;
          chosen_objective: string;
          chosen_notes: string;
          confirmed_review: boolean;
        };
        Returns: string;
      };
      edu_record_impact: {
        Args: {
          wanted_plan: string;
          measured_on: string;
          measured_attendance: number;
          measured_grade: number;
          measured_submissions: number;
          teacher_notes: string;
        };
        Returns: string;
      };
      edu_impact_summary: { Args: Record<string, never>; Returns: ImpactAggregate[] };
    };
  };
};
const db = supabase as unknown as SupabaseClient<ImpactDatabase>;

export const impactStudiesOptions = queryOptions({
  queryKey: ["edu", "impact", "studies"],
  queryFn: async () => {
    const rows: ImpactStudy[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("impact_studies")
        .select("*")
        .order("plan_id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },
});
export const impactSummaryOptions = queryOptions({
  queryKey: ["edu", "impact", "summary"],
  queryFn: async () => {
    const { data, error } = await db.rpc("edu_impact_summary", {});
    if (error) throw error;
    return data;
  },
});
export const impactFollowupsOptions = (planId: string) =>
  queryOptions({
    queryKey: ["edu", "impact", "followups", planId],
    queryFn: async () => {
      const rows: ImpactFollowup[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from("impact_followups")
          .select("*")
          .eq("plan_id", planId)
          .order("observed_on")
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    },
  });
export async function saveImpactDesign(design: ImpactDesign) {
  const d = impactDesignSchema.parse(design);
  const { data, error } = await db.rpc("edu_save_impact_plan", {
    wanted_student: d.student_id,
    wanted_plan: d.plan_id,
    chosen_actions: d.actions,
    chosen_weeks: d.duration_weeks,
    chosen_priority: d.priority,
    chosen_objective: d.objective,
    chosen_notes: d.notes,
    confirmed_review: d.reviewed,
  });
  if (error) throw error;
  return data;
}
export async function recordImpact(planId: string, input: ImpactFollowupInput) {
  const { data, error } = await db.rpc("edu_record_impact", {
    wanted_plan: planId,
    measured_on: input.observed_on,
    measured_attendance: input.attendance,
    measured_grade: input.grade,
    measured_submissions: input.submissions,
    teacher_notes: input.notes,
  });
  if (error) throw error;
  return data;
}
