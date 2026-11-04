import { eduPageHead } from "@/lib/edu/meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EmptyState, PageTitle } from "@/components/edu/ui";
import { buildAlerts } from "@/lib/edu/alerts";
import { loadEducation, useDataset } from "@/lib/edu/store";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/edu/ui";
import { StudentContext } from "@/components/edu/StudentContext";
import { PredictionDemo } from "@/components/edu/PredictionDemo";

export const Route = createFileRoute("/_authenticated/predicciones")({
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  head: ({ match }) => eduPageHead("predictions", match.context.translations),
  component: Predicciones,
});

function Predicciones() {
  const { t } = useTranslation();
  const { dataset, students, account } = useDataset();
  const signals = buildAlerts(dataset.rows);
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
      <PageTitle title={t("predicciones.title")} subtitle={t("predictionDemo.subtitle")} />
      <PredictionDemo students={students} />
      {account.membership?.role === "teacher" && (
        <section className="mt-10 border-t-2 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">{t("predicciones.currentSignals")}</h2>
            <Button variant="outline" asChild>
              <Link to="/alertas">{t("nav.alertas")}</Link>
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("predicciones.currentSignalsText")}
          </p>
          <div className="mt-5 grid gap-3">
            {signals.map((signal) => {
              const student = students.find((s) => s.code === signal.estudiante_id);
              if (!student) return null;
              return (
                <Link
                  key={student.id}
                  to="/estudiantes/$studentId"
                  params={{ studentId: student.id }}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 p-4 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <span className="font-black">
                      {student.code}{" "}
                      <span className="font-bold text-muted-foreground">· {student.course}</span>
                    </span>
                    <StudentContext student={student} />
                  </div>
                  <LevelBadge level={signal.level} />
                </Link>
              );
            })}
            {signals.length === 0 && (
              <p className="text-muted-foreground">{t("alertas.emptyTitle")}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
