import { eduPageHead } from "@/lib/edu/meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, LevelBadge, PageTitle } from "@/components/edu/ui";
import { buildAlerts, THRESHOLDS } from "@/lib/edu/alerts";
import { useDataset, loadEducation } from "@/lib/edu/store";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { Button } from "@/components/ui/button";
import { EduSelect } from "@/components/edu/EduSelect";
import { StudentContext } from "@/components/edu/StudentContext";

export const Route = createFileRoute("/_authenticated/alertas")({
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  notFoundComponent: CloudError,
  head: ({ match }) => eduPageHead("alerts", match.context.translations),
  component: Alertas,
});

function Alertas() {
  const { t, i18n } = useTranslation();
  const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const { dataset, students, account } = useDataset();
  const all = buildAlerts(dataset.rows);
  const grupos = [...new Set(all.map((a) => a.grupo))].sort();
  const [level, setLevel] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const list = all.filter(
    (a) => (level === "todos" || a.level === level) && (grupo === "todos" || a.grupo === grupo),
  );
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
      <PageTitle title={t("alertas.title")} subtitle={t("alertas.subtitle")} />
      <div className="mb-6 border-l-4 border-primary bg-muted p-4 text-sm text-muted-foreground">
        {t("alertas.rules", {
          ar: THRESHOLDS.asistencia.rojo,
          ay: THRESHOLDS.asistencia.amarillo,
          nr: THRESHOLDS.nota_media.rojo,
          ny: THRESHOLDS.nota_media.amarillo,
          tr: THRESHOLDS.tareas_entregadas.rojo,
          ty: THRESHOLDS.tareas_entregadas.amarillo,
        })}
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="w-48">
          <EduSelect
            label={t("alertas.levelFilter")}
            value={level}
            onChange={setLevel}
            options={[
              { value: "todos", label: t("alertas.allLevels") },
              { value: "rojo", label: t("levels.rojo") },
              { value: "amarillo", label: t("levels.amarillo") },
            ]}
          />
        </div>
        <div className="w-48">
          <EduSelect
            label={t("alertas.groupFilter")}
            value={grupo}
            onChange={setGrupo}
            options={[
              { value: "todos", label: t("alertas.allGroups") },
              ...grupos.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <span className="self-center font-bold text-muted-foreground">
          {t("alertas.count", { count: list.length })}
        </span>
      </div>
      {list.length === 0 ? (
        <EmptyState title={t("alertas.emptyTitle")} text={t("alertas.emptyText")} />
      ) : (
        <div className="grid gap-3">
          {list.map((a) => (
            <div
              key={a.estudiante_id}
              className="card-sticker flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 flex-1 basis-72">
                <p className="font-black text-foreground">
                  {a.estudiante_id}{" "}
                  <span className="font-bold text-muted-foreground">· {a.grupo}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.factors
                    .map((f) =>
                      t("alertas.factor", {
                        metric: t(`alertas.metrics.${f.metric}`),
                        value: nf.format(f.value),
                        threshold: nf.format(f.threshold),
                        unit: f.unit,
                      }),
                    )
                    .join(" · ")}
                </p>
                <StudentContext student={students.find((s) => s.code === a.estudiante_id)} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <LevelBadge level={a.level} />
                <Button variant="secondary" asChild>
                  <Link
                    to="/impacto"
                    search={{ studentId: students.find((s) => s.code === a.estudiante_id)?.id }}
                  >
                    {t("nav.impact")}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link
                    to="/estudiantes/$studentId"
                    params={{
                      studentId: students.find((s) => s.code === a.estudiante_id)?.id ?? "",
                    }}
                  >
                    {t("students.open")}
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
