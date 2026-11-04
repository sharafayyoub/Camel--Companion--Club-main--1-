import { queryOptions, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Dashboard } from "./cloud-schema";
import type { StudentRecord } from "./types";

export type CloudStudent = Tables<"students">;
export type CloudPlan = Tables<"intervention_plans">;
export type CloudProposal = Tables<"intervention_proposals">;

export const accountOptions = queryOptions({
  queryKey: ["edu", "account"],
  queryFn: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error("auth");
    const [profile, membership] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_roles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profile.error) throw profile.error;
    if (membership.error) throw membership.error;
    const school = membership.data
      ? await supabase.from("schools").select("*").eq("id", membership.data.school_id).single()
      : null;
    if (school?.error) throw school.error;
    return {
      user,
      profile: profile.data,
      membership: membership.data,
      school: school?.data ?? null,
    };
  },
});

export const studentsOptions = queryOptions({
  queryKey: ["edu", "students"],
  queryFn: async () => {
    const rows: CloudStudent[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("code")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },
});
export const plansOptions = queryOptions({
  queryKey: ["edu", "plans"],
  queryFn: async () => {
    const rows: CloudPlan[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("intervention_plans")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },
});
export const dashboardOptions = queryOptions({
  queryKey: ["edu", "dashboard"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("edu_dashboard");
    if (error) throw error;
    return data as unknown as Dashboard;
  },
});
export const proposalsOptions = queryOptions({
  queryKey: ["edu", "proposals"],
  queryFn: async () => {
    const rows: CloudProposal[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("intervention_proposals")
        .select("*")
        .order("created_at")
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },
});
export async function loadEducation(queryClient: QueryClient) {
  const account = await queryClient.ensureQueryData(accountOptions);
  if (!account.membership) return;
  await Promise.all([
    queryClient.ensureQueryData(studentsOptions),
    queryClient.ensureQueryData(plansOptions),
    queryClient.ensureQueryData(proposalsOptions),
    queryClient.ensureQueryData(dashboardOptions),
  ]);
}
export function asStudentRecord(s: CloudStudent): StudentRecord {
  return {
    estudiante_id: s.code,
    grupo: s.course,
    asistencia: s.attendance,
    nota_media: s.grade,
    tareas_entregadas: s.submissions,
  };
}
export function useDataset() {
  const { data: account } = useSuspenseQuery(accountOptions);
  const { data: students } = useSuspenseQuery(studentsOptions);
  return {
    dataset: {
      source: "cloud" as const,
      name: account.school?.name ?? "",
      rows: students.filter((s) => s.enrollment_status === "active").map(asStudentRecord),
    },
    students,
    account,
  };
}
