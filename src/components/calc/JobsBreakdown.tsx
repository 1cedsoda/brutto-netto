import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import type { DisplayPeriod } from "@/lib/store";
import type { CalculationResult, JobKind, ScenarioResult } from "@/lib/tax/types";

const KIND_KEY: Record<JobKind, Key> = {
  employee: "emp.employee",
  minijob: "emp.minijob",
  self: "emp.self",
};

type Row = {
  key: Key;
  get: (r: CalculationResult) => number;
  strong?: boolean;
  minus?: boolean;
  accent?: string;
  /** only meaningful for employments (shown as "–" for self-employment) */
  employerOnly?: boolean;
};

const ROWS: Row[] = [
  { key: "jobs.gross", get: (r) => r.gross.yearly, strong: true },
  { key: "jobs.tax", get: (r) => r.tax.total.yearly, minus: true },
  { key: "jobs.social", get: (r) => r.employeeSocial.total.yearly, minus: true },
  { key: "jobs.pkv", get: (r) => r.privateHealthEmployee?.yearly ?? 0, minus: true },
  {
    key: "jobs.net",
    get: (r) =>
      r.gross.yearly -
      r.tax.total.yearly -
      r.employeeSocial.total.yearly -
      (r.privateHealthEmployee?.yearly ?? 0),
    strong: true,
    accent: "text-emerald-600 dark:text-emerald-500",
  },
  { key: "jobs.employer", get: (r) => r.employerSocial.total.yearly, employerOnly: true },
  {
    key: "jobs.cost",
    get: (r) => r.employerTotalCost.yearly,
    strong: true,
    employerOnly: true,
  },
];

/**
 * Per-job columns (what each employer pays and withholds) plus the annual
 * settlement via the tax return. Only shown with several jobs / incomes.
 */
export function JobsBreakdown({
  res,
  primary,
}: {
  res: ScenarioResult;
  primary: DisplayPeriod;
}) {
  const t = useT();
  const f = primary === "monthly" ? 1 / 12 : 1;
  const v = (n: number) => formatEUR(n * f);
  const multi = res.jobs.length > 1;
  const rows = ROWS.filter((row) => res.jobs.some((j) => row.get(j.result) !== 0) || row.strong);
  const a = res.annual;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t(multi ? "jobs.title" : "annual.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {multi && (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[28rem] text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 text-left font-normal" />
                  {res.jobs.map(({ job, index }) => (
                    <th key={job.id} className="px-2 py-1.5 text-right font-medium">
                      <div className="text-foreground">
                        {index === 0 ? t("job.main") : `${t("job.n")} ${index + 1}`}
                      </div>
                      <div className="font-normal">{t(KIND_KEY[job.kind])}</div>
                    </th>
                  ))}
                  <th className="py-1.5 pl-2 text-right font-medium text-foreground">
                    {t("jobs.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const na = (i: number) => row.employerOnly && res.jobs[i].job.kind === "self";
                  const vals = res.jobs.map((j) => row.get(j.result));
                  const total = vals.reduce((x, y, i) => (na(i) ? x : x + y), 0);
                  return (
                    <tr key={row.key} className={row.strong ? "border-t" : ""}>
                      <td
                        className={`py-1.5 pr-3 ${row.strong ? "font-medium" : "text-muted-foreground"}`}
                      >
                        {t(row.key)}
                      </td>
                      {vals.map((n, i) => (
                        <td
                          key={i}
                          className={`px-2 py-1.5 text-right ${row.strong ? "font-medium" : ""} ${row.accent ?? ""}`}
                        >
                          {na(i) ? (
                            <span className="text-muted-foreground">–</span>
                          ) : (
                            <>
                              {row.minus && n > 0 ? "−" : ""}
                              {v(n)}
                            </>
                          )}
                        </td>
                      ))}
                      <td
                        className={`py-1.5 pl-2 text-right font-medium ${row.accent ?? ""}`}
                      >
                        {row.minus && total > 0 ? "−" : ""}
                        {v(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {a && (
          <div className="grid gap-1.5 rounded-lg bg-muted/40 px-3 py-3 text-sm tabular-nums">
            {multi && <div className="text-xs font-medium">{t("annual.title")}</div>}
            <Line label={t("annual.tax")} value={v(a.total)} />
            <Line label={t("annual.withheld")} value={v(a.withheld)} />
            <Line
              label={a.balance >= 0 ? t("annual.due") : t("annual.refund")}
              value={`${a.balance >= 0 ? "−" : "+"}${v(Math.abs(a.balance))}`}
              className={
                a.balance >= 0
                  ? "font-medium text-rose-600 dark:text-rose-500"
                  : "font-medium text-emerald-600 dark:text-emerald-500"
              }
            />
            <div className="my-1 border-t" />
            <Line
              label={t("annual.net")}
              value={v(res.total.net.yearly)}
              className="font-semibold text-emerald-600 dark:text-emerald-500"
            />
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("annual.hint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}
