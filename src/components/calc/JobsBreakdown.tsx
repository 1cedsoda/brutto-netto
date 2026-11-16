import { Separator } from "@/components/ui/separator";
import { formatEUR, formatShare } from "@/lib/format";
import { useLabel, useT, type Key } from "@/lib/i18n";
import type { DisplayPeriod } from "@/lib/store";
import type { CalculationResult, JobKind, LineItem, ScenarioResult } from "@/lib/tax/types";

const KIND_KEY: Record<JobKind, Key> = {
  employee: "emp.employee",
  minijob: "emp.minijob",
  self: "emp.self",
};

type Value = { yearly: number };
type Row =
  | { type: "sep" }
  | {
      type: "row";
      label: string;
      /** value per job (null = not applicable) */
      cells: (number | null)[];
      /** total column; defaults to the sum of the cells */
      total?: number;
      strong?: boolean;
      sign?: "minus" | "plus";
      accent?: "net" | "burden";
      /** keep even if all values are zero */
      always?: boolean;
    };

const y = (v: Value | undefined) => v?.yearly ?? 0;

/**
 * The one breakdown table for several jobs: one column per job (what each
 * employer pays and withholds) plus the total, followed by the annual
 * settlement via the tax return.
 */
export function JobsTable({ res, primary }: { res: ScenarioResult; primary: DisplayPeriod }) {
  const t = useT();
  const tl = useLabel();
  const f = primary === "monthly" ? 1 / 12 : 1;
  const rs = res.jobs.map((j) => j.result);
  const isSelf = res.jobs.map((j) => j.job.kind === "self");
  const total = res.total;
  const a = res.annual;
  const hasSelf = isSelf.some(Boolean);

  const ag = (pick: (r: CalculationResult) => LineItem, suffix = true): Row => {
    const item = pick(rs[0]);
    return {
      type: "row",
      label: `${tl(item.label)}${suffix ? ` ${t("sfx.ag")}` : ""}`,
      cells: rs.map((r, i) => (isSelf[i] ? null : y(pick(r)))),
      sign: "minus",
    };
  };
  const an = (pick: (r: CalculationResult) => LineItem | undefined, label: string): Row => ({
    type: "row",
    label,
    cells: rs.map((r) => y(pick(r))),
    sign: "minus",
  });
  const payrollNet = (r: CalculationResult) =>
    r.gross.yearly -
    r.tax.total.yearly -
    r.employeeSocial.total.yearly -
    (r.privateHealthEmployee?.yearly ?? 0);

  const rows: Row[] = [
    {
      type: "row",
      label: hasSelf ? t("r.costMixed") : t("r.agGesamt"),
      cells: rs.map((r) => r.employerTotalCost.yearly),
      strong: true,
      always: true,
    },
    { type: "sep" },
    ag((r) => r.employerSocial.rente),
    ag((r) => r.employerSocial.arbeitslosen),
    ag((r) => r.employerSocial.kranken),
    ag((r) => r.employerSocial.pflege),
    ag((r) => r.employerSocial.insolvenzgeld, false),
    ag((r) => r.employerSocial.u1, false),
    ag((r) => r.employerSocial.u2, false),
    ag((r) => r.employerSocial.unfall, false),
    ag((r) => r.employerSocial.pauschsteuer, false),
    { type: "sep" },
    { type: "row", label: t("r.brutto"), cells: rs.map((r) => r.gross.yearly), strong: true, always: true },
    { type: "sep" },
    an((r) => r.tax.lohnsteuer, t("jobs.tax")),
    an((r) => r.tax.soli, tl("Solidaritätszuschlag")),
    an((r) => r.tax.kirchensteuer, tl("Kirchensteuer")),
    an((r) => r.employeeSocial.rente, `${tl("Rentenversicherung")} ${t("sfx.an")}`),
    an((r) => r.employeeSocial.arbeitslosen, `${tl("Arbeitslosenversicherung")} ${t("sfx.an")}`),
    an((r) => r.employeeSocial.kranken, `${tl("Krankenversicherung")} ${t("sfx.an")}`),
    an((r) => r.employeeSocial.pflege, `${tl("Pflegeversicherung")} ${t("sfx.an")}`),
    an((r) => r.privateHealthEmployee, tl("Private Krankenversicherung")),
    { type: "sep" },
    {
      type: "row",
      label: a ? t("jobs.net") : t("r.netto"),
      cells: rs.map(payrollNet),
      strong: true,
      always: true,
      accent: a ? undefined : "net",
    },
  ];
  if (a) {
    rows.push({
      type: "row",
      label: a.balance >= 0 ? t("annual.due") : t("annual.refund"),
      cells: rs.map(() => null),
      total: -a.balance,
      sign: a.balance >= 0 ? "minus" : "plus",
      always: true,
    });
    rows.push({ type: "sep" });
    rows.push({
      type: "row",
      label: t("annual.net"),
      cells: rs.map(() => null),
      total: total.net.yearly,
      strong: true,
      accent: "net",
      always: true,
    });
  }
  rows.push({
    type: "row",
    label: t("r.steuernAbgaben"),
    cells: rs.map((r) => (a ? null : r.employerTotalCost.yearly - payrollNet(r))),
    total: total.employerTotalCost.yearly - total.net.yearly,
    strong: true,
    accent: "burden",
    always: true,
  });

  const base = total.employerTotalCost.yearly;
  const visible = rows.filter(
    (r) => r.type === "sep" || r.always || r.cells.some((c) => c !== null && Math.abs(c) > 0.005),
  );
  // collapse consecutive separators
  const cleaned = visible.filter(
    (r, i) => !(r.type === "sep" && (i === 0 || visible[i - 1].type === "sep")),
  );

  const fmt = (n: number, sign?: "minus" | "plus") => {
    const v = formatEUR(Math.abs(n) * f);
    if (Math.abs(n) < 0.005) return formatEUR(0);
    if (sign === "minus") return n > 0 ? `−${v}` : `+${v}`;
    if (sign === "plus") return `+${v}`;
    return n < 0 ? `−${v}` : v;
  };
  const color = (accent?: "net" | "burden") =>
    accent === "net"
      ? "text-emerald-600 dark:text-emerald-500"
      : accent === "burden"
        ? "text-rose-600 dark:text-rose-500"
        : "";

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[34rem] text-sm tabular-nums">
        <thead>
          <tr className="align-bottom text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 text-left font-normal">
              {primary === "monthly" ? t("m.perMonth") : t("m.perYear")}
            </th>
            {res.jobs.map(({ job, index }) => (
              <th key={job.id} className="px-2 py-1.5 text-right font-medium">
                <div className="text-foreground">
                  {index === 0 ? t("job.main") : `${t("job.n")} ${index + 1}`}
                </div>
                <div className="font-normal">{t(KIND_KEY[job.kind])}</div>
              </th>
            ))}
            <th className="py-1.5 pl-3 text-right font-medium text-foreground">{t("jobs.total")}</th>
          </tr>
        </thead>
        <tbody>
          {cleaned.map((r, i) =>
            r.type === "sep" ? (
              <tr key={`sep-${i}`}>
                <td colSpan={res.jobs.length + 2} className="py-1">
                  <Separator />
                </td>
              </tr>
            ) : (
              <tr key={`${r.label}-${i}`}>
                <td className={`py-1 pr-3 ${r.strong ? "font-semibold" : "text-muted-foreground"}`}>
                  {r.label}
                </td>
                {r.cells.map((c, j) => (
                  <td
                    key={j}
                    className={`px-2 py-1 text-right ${r.strong ? "font-medium" : ""} ${
                      c === null || Math.abs(c) < 0.005 ? "text-muted-foreground/50" : color(r.accent)
                    }`}
                  >
                    {c === null ? "–" : Math.abs(c) < 0.005 ? "–" : fmt(c, r.sign)}
                  </td>
                ))}
                {(() => {
                  const tot = r.total ?? r.cells.reduce<number>((s, c) => s + (c ?? 0), 0);
                  return (
                    <td className={`py-1 pl-3 text-right ${r.strong ? "font-semibold" : "font-medium"} ${color(r.accent)}`}>
                      <div>{fmt(tot, r.sign)}</div>
                      {base > 0 && Math.abs(tot) > 0.005 && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {formatShare(Math.abs(tot), base)}
                        </div>
                      )}
                    </td>
                  );
                })()}
              </tr>
            ),
          )}
        </tbody>
      </table>
      {a && (
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          {t("annual.hint")} {t("annual.tax")}: {formatEUR(a.total * f)}, {t("annual.withheld")}:{" "}
          {formatEUR(a.withheld * f)}.
        </p>
      )}
    </div>
  );
}

