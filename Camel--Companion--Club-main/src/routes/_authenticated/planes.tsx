import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDataset, plansOptions, proposalsOptions, loadEducation } from "@/lib/edu/store";
import { eduPageHead } from "@/lib/edu/meta";
import { PlanList } from "@/components/edu/PlanList";
import { ProposalList } from "@/components/edu/ProposalList";
import { PageTitle, EmptyState } from "@/components/edu/ui";
import { Button } from "@/components/ui/button";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { PlanEditor } from "@/components/edu/PlanEditor";
import { findHandoffStudent, planHandoffSearch } from "@/lib/edu/plan-handoff";
import { X } from "lucide-react";
export const Route = createFileRoute("/_authenticated/planes")({
  validateSearch: (search) => planHandoffSearch.parse(search),
  head: ({ match }) => eduPageHead("plans", match.context.translations),
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  notFoundComponent: CloudError,
  component: Plans,
});
function Plans() {
  const { t } = useTranslation();
  const { students, account } = useDataset();
  const { data: plans } = useSuspenseQuery(plansOptions);
  const { data: proposals } = useSuspenseQuery(proposalsOptions);
  const { studentId, source } = Route.useSearch();
  const student = findHandoffStudent(students, studentId);
  if (account.membership?.role === "director")
    return (
      <EmptyState title={t("school.director")} text={t("school.aggregateOnly")}>
        <Button asChild>
          <Link to="/panel">{t("nav.panel")}</Link>
        </Button>
      </EmptyState>
    );
  return (
    <div>
      <PageTitle title={t("planes.title")} subtitle={t("planes.subtitle")}>
        <Button asChild>
          <Link to="/datos">{t("students.title")}</Link>
        </Button>
      </PageTitle>
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link to="/impacto" search={student ? { studentId: student.id } : {}}>
            {t("impact.title")}
          </Link>
        </Button>
      </div>
      {studentId && !student && (
        <p role="alert" className="mb-6 text-destructive">
          {t("students.notFound")}
        </p>
      )}
      {student && (
        <section className="mb-8 border-y-2 py-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-black text-secondary">
                {student.code} · {student.course}
              </p>
              {source === "predictionDemo" && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {t("predictionDemo.handoffNote")}
                </p>
              )}
            </div>
            <Button size="icon" variant="ghost" asChild>
              <Link
                to="/planes"
                search={{}}
                aria-label={t("predictionDemo.closeHandoff")}
                title={t("predictionDemo.closeHandoff")}
              >
                <X />
              </Link>
            </Button>
          </div>
          <div className="max-w-2xl">
            <PlanEditor key={student.id} student={student} />
          </div>
        </section>
      )}
      {plans.length ? (
        <PlanList plans={plans} students={students} />
      ) : !proposals.length ? (
        <EmptyState title={t("planes.emptyTitle")} text={t("plansCloud.empty")}>
          <Button asChild>
            <Link to="/datos">{t("students.title")}</Link>
          </Button>
        </EmptyState>
      ) : null}
      <ProposalList proposals={proposals} students={students} />
    </div>
  );
}
