import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useDataset, plansOptions, loadEducation } from "@/lib/edu/store";
import {
  impactStudiesOptions,
  impactSummaryOptions,
  impactFollowupsOptions,
  saveImpactDesign,
  recordImpact,
} from "@/lib/edu/impact-store";
import { eduPageHead } from "@/lib/edu/meta";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, EmptyState } from "@/components/edu/ui";
import { Button } from "@/components/ui/button";
import { EduSelect } from "@/components/edu/EduSelect";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { ImpactDesigner } from "@/components/edu/ImpactDesigner";
import { ImpactFollowupPanel } from "@/components/edu/ImpactFollowup";
import { ImpactSummary } from "@/components/edu/ImpactSummary";

export const Route = createFileRoute("/_authenticated/impacto")({
  validateSearch: z.object({ studentId: z.string().uuid().optional().catch(undefined) }),
  head: ({ match }) => eduPageHead("impact", match.context.translations),
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  component: ImpactLab,
});
function ImpactLab() {
  const { t } = useTranslation();
  const { students, account } = useDataset();
  const { data: plans } = useSuspenseQuery(plansOptions);
  const director = account.membership?.role === "director";
  const studies = useQuery({ ...impactStudiesOptions, enabled: !director });
  const summary = useQuery(impactSummaryOptions);
  const [planId, setPlanId] = useState("");
  const { studentId } = Route.useSearch();
  const student = studentId ? students.find((s) => s.id === studentId) : students[0];
  const plan = plans.find((p) => p.id === planId && p.student_id === student?.id);
  const study = studies.data?.find((s) => s.plan_id === plan?.id);
  const followups = useQuery({
    ...impactFollowupsOptions(plan?.id ?? ""),
    enabled: Boolean(study),
  });
  const navigate = useNavigate();
  const client = useQueryClient();
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["edu"] });
  }
  const error = summary.isError || studies.isError || followups.isError;
  return (
    <div className="space-y-8">
      <PageTitle title={t("impact.title")} subtitle={t("impact.subtitle")}>
        <Button asChild variant="outline">
          <Link to="/demo/impacto">
            <FlaskConical aria-hidden />
            {t("impact.demo")}
          </Link>
        </Button>
      </PageTitle>
      <ol className="impact-steps">
        {["compare", "scenario", "decision", "followup"].map((step, index) => (
          <li key={step}>
            <span aria-hidden>{index + 1}</span>
            {t(`impact.${step}`)}
          </li>
        ))}
      </ol>
      {error ? (
        <div role="alert" className="impact-surface space-y-3 p-6">
          <h2 className="text-xl">{t("impact.unavailable")}</h2>
          <p className="text-sm text-muted-foreground">{t("impact.unavailableHelp")}</p>
          <Button
            variant="outline"
            onClick={() => {
              void studies.refetch();
              void summary.refetch();
              if (study) void followups.refetch();
            }}
          >
            {t("common.error.retry")}
          </Button>
        </div>
      ) : summary.isPending || (!director && studies.isPending) ? (
        <CloudPending />
      ) : (
        <>
          {!director && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-bold">
                  {t("impact.chooseStudent")}
                  <EduSelect
                    label={t("impact.chooseStudent")}
                    value={student?.id ?? ""}
                    onChange={(id) => {
                      setPlanId("");
                      void navigate({ to: "/impacto", search: { studentId: id } });
                    }}
                    options={students.map((s) => ({
                      value: s.id,
                      label: `${s.code} · ${s.course}`,
                    }))}
                  />
                </label>
                <label className="space-y-2 text-sm font-bold">
                  {t("impact.linkPlan")}
                  <EduSelect
                    label={t("impact.linkPlan")}
                    value={plan?.id ?? "new"}
                    onChange={(id) => setPlanId(id === "new" ? "" : id)}
                    options={[
                      { value: "new", label: t("impact.newPlan") },
                      ...plans
                        .filter((p) => p.student_id === student?.id)
                        .map((p) => ({
                          value: p.id,
                          label: `${t(`plansCloud.actions.${p.support_action}`)} · ${t(`planes.statuses.${p.status}`)}`,
                        })),
                    ]}
                  />
                </label>
              </div>
              {student ? (
                <>
                  <ImpactDesigner
                    key={`${student.id}:${plan?.id ?? "new"}`}
                    student={student}
                    {...(plan ? { plan } : {})}
                    {...(study ? { study } : {})}
                    onSave={async (design) => {
                      const id = await saveImpactDesign(design);
                      setPlanId(id);
                      await refresh();
                      toast.success(t("impact.approved"));
                    }}
                  />
                  {study &&
                    plan &&
                    (followups.isPending ? (
                      <CloudPending />
                    ) : (
                      <ImpactFollowupPanel
                        key={study.plan_id}
                        study={study}
                        plan={plan}
                        followups={followups.data ?? []}
                        onRecord={async (input) => {
                          await recordImpact(plan.id, input);
                          await refresh();
                          toast.success(t("cloud.saved"));
                        }}
                        onStatus={async (status) => {
                          const { error } = await supabase
                            .from("intervention_plans")
                            .update({ status })
                            .eq("id", plan.id)
                            .select("id")
                            .single();
                          if (error) throw error;
                          await refresh();
                        }}
                      />
                    ))}
                </>
              ) : (
                <EmptyState
                  title={t(studentId ? "students.notFound" : "students.emptyTitle")}
                  text={t("students.emptyText")}
                >
                  <Button asChild>
                    <Link to="/datos">{t("students.title")}</Link>
                  </Button>
                </EmptyState>
              )}
            </>
          )}
          <ImpactSummary rows={summary.data ?? []} />
        </>
      )}
    </div>
  );
}
