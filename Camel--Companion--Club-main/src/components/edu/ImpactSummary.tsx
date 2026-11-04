import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { MIN_COHORT, type ImpactAggregate } from "@/lib/edu/impact";

export function ImpactSummary({ rows, demo = false }: { rows: ImpactAggregate[]; demo?: boolean }) {
  const { t, i18n } = useTranslation();
  const nf = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  // Defence in depth; suppression is enforced by SQL, before any data leaves the server.
  const safeRows = rows.filter((r) => r.students >= MIN_COHORT);
  return (
    <section className="impact-surface space-y-4 p-5 sm:p-6">
      <h2 className="text-xl">{t("impact.institutional")}</h2>
      {demo && <p className="text-sm font-bold text-secondary">{t("impact.fictionalAggregate")}</p>}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("impact.privacyThreshold", { count: MIN_COHORT })}
      </p>
      {safeRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="mb-3 text-left text-xs text-muted-foreground">
              {t("impact.aggregateMethod")}
            </caption>
            <thead>
              <tr>
                <th className="py-3 pr-3">{t("plansCloud.action")}</th>
                <th className="pr-3">{t("dashboard.students")}</th>
                <th className="pr-3">{t("impact.metrics.attendance")}</th>
                <th className="pr-3">{t("impact.metrics.grade")}</th>
                <th>{t("impact.metrics.submissions")}</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((r) => (
                <tr key={r.action} className="border-t">
                  <th className="py-4 pr-3 font-semibold">{t(`plansCloud.actions.${r.action}`)}</th>
                  <td className="pr-3">{r.students}</td>
                  <td className="pr-3">
                    {nf.format(r.attendance_change)} {t("impact.percentagePoints")}
                  </td>
                  <td className="pr-3">
                    {nf.format(r.grade_change)} {t("impact.gradePoints")}
                  </td>
                  <td>
                    {nf.format(r.submissions_change)} {t("impact.percentagePoints")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-4 text-sm">{t("impact.suppressed")}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("impact.observedNotice")}</p>
    </section>
  );
}
