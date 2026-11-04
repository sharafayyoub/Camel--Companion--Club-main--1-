import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { PageTitle, EmptyState, LevelBadge } from "@/components/edu/ui";
import { dashboardOptions, useDataset, loadEducation } from "@/lib/edu/store";
import { eduPageHead } from "@/lib/edu/meta";
import { evaluateStudent } from "@/lib/edu/alerts";
import { SchoolInvites } from "@/components/edu/SchoolInvites";
import { CloudError, CloudPending } from "@/components/edu/CloudFeedback";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/panel")({
  head: ({ match }) => eduPageHead("panel", match.context.translations),
  loader: ({ context }) => loadEducation(context.queryClient),
  errorComponent: CloudError,
  pendingComponent: CloudPending,
  notFoundComponent: CloudError,
  component: Panel,
});
function Panel() {
  const { t, i18n } = useTranslation();
  const { dataset, students, account } = useDataset();
  const { data: d, refetch, isFetching } = useSuspenseQuery(dashboardOptions);
  const director = account.membership?.role === "director";
  const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const fmt = (v: number | null, suffix = "") => (v === null ? "–" : `${nf.format(v)}${suffix}`);
  const kpis = [
    ["students", d.total, ""],
    ["attendance", d.attendance, "%"],
    ["retention", d.retention, "%"],
    ["resources", d.resources, "%"],
    ["plans", d.plans, ""],
    ["completedPlans", d.completedPlans, ""],
  ] as const;
  if (d.privacySuppressed)
    return (
      <div className="space-y-8">
        <PageTitle title={t("dashboard.director")} subtitle={account.school?.name ?? ""} />
        <EmptyState title={t("impact.smallGroups")} text={t("impact.smallGroupsHelp")}>
          <Button variant="outline" asChild>
            <Link to="/impacto">{t("impact.institutional")}</Link>
          </Button>
        </EmptyState>
        <SchoolInvites />
      </div>
    );
  return (
    <div>
      <PageTitle
        title={t(director ? "dashboard.director" : "dashboard.teacher")}
        subtitle={account.school?.name ?? ""}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-secondary">{t("cloud.live")}</span>
          <Button
            size="icon"
            variant="outline"
            disabled={isFetching}
            title={t("dashboard.refresh")}
            aria-label={t("dashboard.refresh")}
            onClick={() => void refetch()}
          >
            <RefreshCw />
          </Button>
        </div>
      </PageTitle>
      {(d.containsSamples || students.some((s) => s.is_sample)) && (
        <p className="mb-4 text-sm font-bold text-secondary">{t("common.demoData")}</p>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">{t("impact.subtitle")}</p>
        <Button variant="secondary" asChild>
          <Link to="/impacto">{t("impact.title")}</Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([key, value, suffix]) => (
          <article key={key} className="rounded-lg border-2 p-4">
            <p className="text-xs font-bold text-muted-foreground">{t(`dashboard.${key}`)}</p>
            <p className="mt-3 text-3xl font-black">{fmt(value, suffix)}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("dashboard.retentionDefinition")}</p>
      {d.total === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("dashboard.empty")}
            text={t(director ? "dashboard.emptyDirector" : "students.emptyText")}
          >
            {!director && (
              <Button asChild>
                <Link to="/datos">{t("students.new")}</Link>
              </Button>
            )}
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="mt-10 grid gap-8 lg:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <h2 className="mb-4 text-2xl">{t("dashboard.groups")}</h2>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-3 pr-4">{t("students.course")}</th>
                    <th>{t("dashboard.students")}</th>
                    <th>{t("panel.colAttendance")}</th>
                    <th>{t("panel.colTasks")}</th>
                    <th>{t("dashboard.resources")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => (
                    <tr key={g.grupo} className="border-t">
                      <td className="py-4 pr-4 font-black">{g.grupo}</td>
                      <td>{g.total}</td>
                      <td>{fmt(g.asistencia, "%")}</td>
                      <td>{fmt(g.tareas_entregadas, "%")}</td>
                      <td>{fmt(g.recursos, "%")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl">{t("panel.gradeByGroup")}</h2>
              <div className="mt-4 h-64 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.groups}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="grupo" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Bar
                      dataKey="nota_media"
                      name={t("students.grade")}
                      fill="var(--chart-1)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section className="mt-10 border-t-2 pt-8">
            <h2 className="text-2xl">{t("dashboard.evolution")}</h2>
            <div className="mt-4 h-64 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.trend}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(day) =>
                      new Intl.DateTimeFormat(i18n.language, {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${day}T00:00:00Z`))
                    }
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    labelFormatter={(day) =>
                      new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(`${day}T00:00:00Z`))
                    }
                  />
                  <Line
                    dataKey="attendance"
                    name={t("dashboard.attendance")}
                    stroke="var(--chart-2)"
                    strokeWidth={3}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="mt-10 border-t-2 pt-8">
            <h2 className="text-2xl">{t("dashboard.impact")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("dashboard.impactNote")}</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-3 pr-4">{t("dashboard.resources")}</th>
                    <th>{t("dashboard.students")}</th>
                    <th>{t("dashboard.attendance")}</th>
                    <th>{t("students.submissions")}</th>
                    <th>{t("dashboard.change")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.impact.map((r) => (
                    <tr key={r.usage} className="border-t">
                      <td className="py-4 pr-4 font-bold">{t(`dashboard.usage.${r.usage}`)}</td>
                      <td>{r.total}</td>
                      <td>{fmt(r.attendance, "%")}</td>
                      <td>{fmt(r.submissions, "%")}</td>
                      <td>{fmt(r.change, t("dashboard.points"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {!director && (
            <section className="mt-10 border-t-2 pt-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl">{t("students.title")}</h2>
                <Button variant="outline" asChild>
                  <Link to="/datos">{t("students.manage")}</Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => {
                  const record = dataset.rows.find((r) => r.estudiante_id === s.code);
                  return (
                    <Link
                      key={s.id}
                      to="/estudiantes/$studentId"
                      params={{ studentId: s.id }}
                      className="flex items-center justify-between gap-3 rounded-lg border-2 p-4 hover:bg-muted"
                    >
                      <div>
                        <p className="font-black">{s.code}</p>
                        <p className="text-sm text-muted-foreground">{s.course}</p>
                      </div>
                      {record && <LevelBadge level={evaluateStudent(record).level} />}
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      {director && <SchoolInvites />}
    </div>
  );
}
