import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FlaskConical, RotateCcw } from "lucide-react";
import { PageTitle } from "@/components/edu/ui";
import { Button } from "@/components/ui/button";
import { ImpactDesigner } from "@/components/edu/ImpactDesigner";
import { ImpactFollowupPanel } from "@/components/edu/ImpactFollowup";
import { ImpactSummary } from "@/components/edu/ImpactSummary";
import {
  aggregateExperiences,
  utcDay,
  type ImpactStudy,
  type ImpactFollowup,
} from "@/lib/edu/impact";
import type { CloudStudent, CloudPlan } from "@/lib/edu/store";
import { eduPageHead } from "@/lib/edu/meta";

export const Route = createFileRoute("/demo/impacto")({
  ssr: false,
  head: ({ match }) => eduPageHead("impact", match.context.translations),
  component: Demo,
});
function Demo() {
  const [version, setVersion] = useState(0);
  const { t } = useTranslation();
  return (
    <div className="space-y-7">
      <PageTitle title={t("impact.title")} subtitle={t("impact.subtitle")}>
        <Button variant="outline" onClick={() => setVersion((v) => v + 1)}>
          <RotateCcw aria-hidden />
          {t("impact.resetDemo")}
        </Button>
      </PageTitle>
      <p
        className="flex items-start gap-3 rounded-xl border border-secondary/30 bg-accent p-4 text-sm font-semibold"
        role="note"
      >
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
        {t("impact.demoNotice")}
      </p>
      <DemoWorkspace key={version} />
      <Button asChild variant="outline">
        <Link to="/impacto">{t("impact.openPrivate")}</Link>
      </Button>
    </div>
  );
}
function DemoWorkspace() {
  const { t } = useTranslation();
  const [student] = useState<CloudStudent>(() => ({
    id: "81020000-0000-4000-8000-000000000001",
    school_id: "81020000-0000-4000-8000-000000000002",
    teacher_id: "81020000-0000-4000-8000-000000000003",
    code: "ALU-DEMO-01",
    course: "2º ESO",
    attendance: 71,
    grade: 4.2,
    submissions: 52,
    resource_usage: 12,
    connectivity: "intermittent",
    observations: "",
    enrollment_status: "active",
    is_sample: true,
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 28 * 86400000).toISOString(),
  }));
  const [plan, setPlan] = useState<CloudPlan | null>(null);
  const [study, setStudy] = useState<ImpactStudy | null>(null);
  const [followups, setFollowups] = useState<ImpactFollowup[]>([]);
  const fictionalRows = aggregateExperiences(
    Array.from({ length: 12 }, (_, index) => ({
      student_id: `fiction-${index}`,
      action: index < 6 ? ("tutoring" as const) : ("resources" as const),
      baseline: { attendance: 70 + index, grade: 4 + index / 10, submissions: 50 + index },
      followup: { attendance: 75 + index, grade: 5 + index / 10, submissions: 58 + index },
      observed_on: utcDay(),
      is_sample: true,
    })),
    true,
  );
  return (
    <div className="space-y-8">
      <ImpactDesigner
        key={plan?.id ?? "new"}
        student={student}
        {...(plan ? { plan } : {})}
        {...(study ? { study } : {})}
        initialDraft={{ objective: t("impact.demoObjective"), notes: t("impact.demoNotes") }}
        onSave={async (design) => {
          const id = plan?.id ?? crypto.randomUUID();
          const now = new Date().toISOString();
          setPlan({
            id,
            student_id: student.id,
            school_id: student.school_id,
            teacher_id: student.teacher_id,
            support_action: design.actions[0]!,
            action_detail: design.objective,
            priority: design.priority,
            notes: design.notes,
            reviewed: true,
            reviewed_at: now,
            created_at: plan?.created_at ?? now,
            status: plan?.status ?? "pendiente",
            is_sample: true,
          });
          setStudy({
            plan_id: id,
            actions: design.actions,
            duration_weeks: design.duration_weeks,
            baseline_attendance: study?.baseline_attendance ?? student.attendance,
            baseline_grade: study?.baseline_grade ?? student.grade,
            baseline_submissions: study?.baseline_submissions ?? student.submissions,
            baseline_on: study?.baseline_on ?? student.updated_at.slice(0, 10),
            created_at: study?.created_at ?? now,
          });
        }}
      />
      {plan && study && (
        <>
          <div className="rounded-xl border border-secondary/30 bg-accent/40 p-5" role="status">
            <p className="font-bold">{t("impact.demoApproved")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("impact.demoExampleHelp")}</p>
            <Button
              className="mt-4 h-auto min-h-11 whitespace-normal"
              variant="outline"
              disabled={followups.some((f) => f.observed_on === utcDay())}
              onClick={() => {
                setFollowups([
                  ...followups,
                  {
                    id: crypto.randomUUID(),
                    plan_id: plan.id,
                    attendance: 82,
                    grade: 5.4,
                    submissions: 68,
                    notes: t("impact.demoFollowupNotes"),
                    observed_on: utcDay(),
                    created_at: new Date().toISOString(),
                  },
                ]);
                setPlan({ ...plan, status: "en_curso" });
              }}
            >
              {t("impact.loadExample")}
            </Button>
          </div>
          <ImpactFollowupPanel
            study={study}
            plan={plan}
            followups={followups}
            onRecord={async (input) => {
              if (followups.some((f) => f.observed_on === input.observed_on))
                throw { code: "23505" };
              setFollowups([
                ...followups,
                {
                  ...input,
                  id: crypto.randomUUID(),
                  plan_id: plan.id,
                  created_at: new Date().toISOString(),
                },
              ]);
            }}
            onStatus={async (status) => {
              setPlan({ ...plan, status });
            }}
          />
        </>
      )}
      <ImpactSummary rows={fictionalRows} demo />
    </div>
  );
}
