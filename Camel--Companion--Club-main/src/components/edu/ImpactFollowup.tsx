import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EduSelect } from "./EduSelect";
import {
  METRICS,
  baselineMetrics,
  followupSchema,
  observedChange,
  utcDay,
  type ImpactStudy,
  type ImpactFollowup,
  type ImpactFollowupInput,
} from "@/lib/edu/impact";
import type { CloudPlan } from "@/lib/edu/store";
import { STATUSES } from "@/lib/edu/cloud-schema";

export function ImpactFollowupPanel({
  study,
  followups,
  plan,
  onRecord,
  onStatus,
}: {
  study: ImpactStudy;
  followups: ImpactFollowup[];
  plan: CloudPlan;
  onRecord: (input: ImpactFollowupInput) => Promise<void>;
  onStatus: (status: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(utcDay());
  const [values, setValues] = useState({ attendance: NaN, grade: NaN, submissions: NaN });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const before = baselineMetrics(study);
  const ordered = [...followups].sort((a, b) => a.observed_on.localeCompare(b.observed_on));
  const latest = ordered.at(-1);
  const delta = latest ? observedChange(before, latest) : null;
  const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const fmtDate = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${day}T00:00:00Z`),
    );
  async function record(event: FormEvent) {
    event.preventDefault();
    const result = followupSchema(study.baseline_on).safeParse({
      ...values,
      observed_on: date,
      notes,
    });
    if (!result.success) {
      setError(t("impact.followupInvalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onRecord(result.data);
      setNotes("");
      setValues({ attendance: NaN, grade: NaN, submissions: NaN });
    } catch (reason) {
      setError(
        t(
          (reason as { code?: string }).code === "23505"
            ? "impact.duplicateDate"
            : "impact.saveError",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  const points = [
    { day: study.baseline_on, ...before },
    ...ordered.map((f) => ({
      day: f.observed_on,
      attendance: f.attendance,
      grade: f.grade,
      submissions: f.submissions,
    })),
  ];
  return (
    <section className="impact-surface space-y-6 p-5 sm:p-6" aria-label={t("impact.followup")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-xl">
          <ClipboardCheck className="size-5 text-secondary" aria-hidden />
          {t("impact.followup")}
        </h2>
        <div className="w-full sm:w-48">
          <EduSelect
            label={t("planes.status")}
            value={plan.status}
            disabled={saving}
            options={STATUSES.map((value) => ({ value, label: t(`planes.statuses.${value}`) }))}
            onChange={(status) => {
              setSaving(true);
              setError("");
              void onStatus(status)
                .catch(() => setError(t("impact.saveError")))
                .finally(() => setSaving(false));
            }}
          />
        </div>
      </div>
      <p className="rounded-lg bg-muted p-3 text-sm" role="note">
        {t("impact.observedNotice")}
      </p>
      <p className="text-xs text-muted-foreground">{t("impact.participationProxy")}</p>
      {latest && delta ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {METRICS.map((metric) => (
              <div key={metric} className="rounded-lg border p-4">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t(`impact.metrics.${metric}`)}
                </dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums">
                  {signed.format(delta[metric])}
                  <span className="ml-1 text-xs font-medium">
                    {t(metric === "grade" ? "impact.gradePoints" : "impact.percentagePoints")}
                  </span>
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nf.format(before[metric])} → {nf.format(latest[metric])}
                </p>
              </div>
            ))}
          </dl>
          <div className="h-72 min-w-0" role="img" aria-label={t("impact.chartLabel")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 4, left: -20, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(day: string) => day.slice(5)}
                  minTickGap={24}
                />
                <YAxis yAxisId="percent" domain={[0, 100]} />
                <YAxis yAxisId="grade" orientation="right" domain={[0, 10]} width={30} />
                <Tooltip labelFormatter={(day) => fmtDate(String(day))} />
                <Legend />
                <Line
                  yAxisId="percent"
                  dataKey="attendance"
                  name={t("impact.metrics.attendance")}
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  connectNulls={false}
                />
                <Line
                  yAxisId="percent"
                  dataKey="submissions"
                  name={t("impact.metrics.submissions")}
                  stroke="var(--chart-2)"
                  strokeDasharray="5 3"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="grade"
                  dataKey="grade"
                  name={t("impact.metrics.grade")}
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("impact.noFollowups")}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-sm">
          <caption className="mb-3 text-left font-bold">{t("impact.history")}</caption>
          <thead>
            <tr>
              <th className="p-2">{t("impact.date")}</th>
              {METRICS.map((m) => (
                <th className="p-2" key={m}>
                  {t(`impact.metrics.${m}`)} {m === "grade" ? "/10" : "%"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t bg-muted/50">
              <th className="p-2 font-medium">
                {fmtDate(study.baseline_on)} · {t("impact.baseline")}
              </th>
              {METRICS.map((m) => (
                <td key={m} className="p-2 tabular-nums">
                  {nf.format(before[m])}
                </td>
              ))}
            </tr>
            {ordered.map((f) => (
              <tr key={f.id} className="border-t">
                <th className="p-2 font-medium">
                  {fmtDate(f.observed_on)}
                  <details className="mt-1 max-w-xs">
                    <summary className="cursor-pointer text-xs text-secondary">
                      {t("plansCloud.notes")}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs font-normal">
                      {f.notes}
                    </p>
                  </details>
                </th>
                {METRICS.map((m) => (
                  <td className="p-2 tabular-nums" key={m}>
                    {nf.format(f[m])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.status !== "descartado" && (
        <form onSubmit={record} className="space-y-4 border-t pt-5" aria-label={t("impact.record")}>
          <h3 className="text-lg">{t("impact.record")}</h3>
          <p className="text-xs text-muted-foreground">{t("impact.manualObservation")}</p>
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-bold">
              {t("impact.date")}
              <Input
                type="date"
                required
                min={study.baseline_on}
                max={utcDay()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {METRICS.map((m) => (
              <label key={m} className="space-y-2 text-sm font-bold">
                {t(`impact.metrics.${m}`)} {m === "grade" ? "/10" : "%"}
                <Input
                  type="number"
                  min={0}
                  max={m === "grade" ? 10 : 100}
                  step="0.1"
                  required
                  value={Number.isNaN(values[m]) ? "" : values[m]}
                  onChange={(e) => setValues({ ...values, [m]: e.target.valueAsNumber })}
                />
              </label>
            ))}
          </fieldset>
          <label className="block space-y-2 text-sm font-bold">
            {t("plansCloud.notes")}
            <Textarea
              required
              maxLength={3000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("students.privacy")}</p>
          <Button type="submit" disabled={saving}>
            {t(saving ? "cloud.saving" : "impact.record")}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
