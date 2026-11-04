import { EduSelect } from "@/components/edu/EduSelect";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CloudPlan, CloudStudent } from "@/lib/edu/store";
import { STATUSES } from "@/lib/edu/cloud-schema";
import { Button } from "@/components/ui/button";

export function PlanList({ plans, students }: { plans: CloudPlan[]; students: CloudStudent[] }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status?: string }) => {
      const result = status
        ? await supabase
            .from("intervention_plans")
            .update({ status })
            .eq("id", id)
            .select("id")
            .single()
        : await supabase.from("intervention_plans").delete().eq("id", id).select("id").single();
      if (result.error) throw result.error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["edu"] }),
    onError: () => toast.error(t("cloud.error")),
  });
  return (
    <div className="space-y-4">
      {plans.map((p) => {
        const student = students.find((s) => s.id === p.student_id);
        return (
          <article key={p.id} className="rounded-lg border-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  className="font-black text-secondary"
                  to="/estudiantes/$studentId"
                  params={{ studentId: p.student_id }}
                >
                  {student?.code}
                </Link>
                <h3 className="mt-1 break-words text-lg">
                  {p.action_detail || t(`plansCloud.actions.${p.support_action}`)}
                </h3>
                {p.is_sample && (
                  <p className="mt-2 text-xs font-bold text-secondary">{t("common.demoData")}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={update.isPending}
                title={t("planes.delete")}
                aria-label={t("planes.delete")}
                onClick={() => {
                  if (window.confirm(t("plansCloud.deleteConfirm"))) update.mutate({ id: p.id });
                }}
              >
                <Trash2 />
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words">{p.notes}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-sm font-bold">{t(`plansCloud.priorities.${p.priority}`)}</span>
              <div className="w-44">
                <EduSelect
                  label={t("planes.status")}
                  value={p.status}
                  disabled={update.isPending}
                  onChange={(status) => update.mutate({ id: p.id, status })}
                  options={STATUSES.map((value) => ({
                    value,
                    label: t(`planes.statuses.${value}`),
                  }))}
                />
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCheck className="h-4 w-4" />
                {t("planes.reviewed")} ·{" "}
                {new Intl.DateTimeFormat(i18n.language).format(new Date(p.reviewed_at))}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
