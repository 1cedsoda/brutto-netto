import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { CompositionBar, BreakdownDonut } from "./Charts";
import { MoneyPair } from "./Money";
import { useResult } from "./shared";
import { useCalcStore, type ScenarioKey, type DisplayPeriod } from "@/lib/store";
import { formatPct, formatShare } from "@/lib/format";
import { useT, useLabel } from "@/lib/i18n";
import { ProgressionChart } from "./ProgressionChart";
import type { CalculationResult, LineItem } from "@/lib/tax/types";

function StatTile({
  label,
  value,
  primary,
  share,
  accent,
}: {
  label: string;
  value: { monthly: number; yearly: number };
  primary: DisplayPeriod;
  /** share string of gross (omit on the gross tile itself) */
  share?: string;
  accent?: "net" | "cost" | "gross";
}) {
  const ring =
    accent === "net"
      ? "ring-emerald-500/30 bg-emerald-500/5"
      : accent === "cost"
        ? "ring-slate-400/30 bg-slate-400/5"
        : "ring-border bg-muted/30";
  const text =
    accent === "net" ? "text-emerald-600 dark:text-emerald-500" : "text-foreground";
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${ring}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <MoneyPair
        monthly={value.monthly}
        yearly={value.yearly}
        primary={primary}
        share={share}
        size="lg"
        align="left"
        className={`mt-0.5 ${text}`}
      />
    </div>
  );
}

function BreakRow({
  label,
  value,
  primary,
  base,
  sign,
  strong,
  accent,
  ratePct,
}: {
  label: string;
  value: { monthly: number; yearly: number };
  primary: DisplayPeriod;
  /** reference for the relative share, typically Brutto */
  base?: { monthly: number; yearly: number };
  sign?: "minus" | "plus";
  strong?: boolean;
  accent?: "net" | "burden";
  ratePct?: number;
}) {
  if (!strong && value.monthly === 0 && (ratePct === undefined || ratePct === 0))
    return null;
  const color =
    accent === "net"
      ? "text-emerald-600 dark:text-emerald-500"
      : accent === "burden"
        ? "text-rose-600 dark:text-rose-500"
        : "";
  const share = base ? formatShare(value.monthly, base.monthly) : undefined;
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-2 py-1">
      <span
        className={`pt-0.5 text-sm ${strong ? "font-semibold" : "text-muted-foreground"}`}
      >
        {label}
        {ratePct !== undefined && ratePct > 0 && (
          <span className="ml-1.5 text-xs text-muted-foreground/60">
            {formatPct(ratePct)}
          </span>
        )}
      </span>
      <MoneyPair
        monthly={value.monthly}
        yearly={value.yearly}
        primary={primary}
        sign={sign}
        share={share}
        className={`${strong ? "font-semibold" : ""} ${color}`}
      />
    </div>
  );
}

type RowProps = Omit<React.ComponentProps<typeof BreakRow>, "primary" | "base">;

const row = (item: LineItem) => ({ monthly: item.monthly, yearly: item.yearly });

/** Unified employer→employee table (Arbeitnehmer + Arbeitgeber). */
function UnifiedTable({
  result,
  primary,
}: {
  result: CalculationResult;
  primary: DisplayPeriod;
}) {
  const t = useT();
  const tl = useLabel();
  const a = result.employerSocial;
  const e = result.employeeSocial;
  // In the combined view the employer's total cost is the 100% reference.
  const base = result.employerTotalCost;
  const R = (p: RowProps) => <BreakRow {...p} primary={primary} base={base} />;
  const ag = (i: LineItem) => `${tl(i.label)} ${t("sfx.ag")}`;
  const an = (i: LineItem) => `${tl(i.label)} ${t("sfx.an")}`;
  const se = result.meta.selfEmployed;
  return (
    <div>
      {!se && (
        <>
      <R label={t("r.agGesamt")} value={result.employerTotalCost} strong />
      <Separator className="my-1.5" />
      <R label={ag(a.rente)} value={row(a.rente)} sign="minus" ratePct={a.rente.ratePct} />
      <R label={ag(a.arbeitslosen)} value={row(a.arbeitslosen)} sign="minus" ratePct={a.arbeitslosen.ratePct} />
      <R label={`${tl(a.kranken.label)} ${t("sfx.ag")}`} value={row(a.kranken)} sign="minus" ratePct={a.kranken.ratePct} />
      <R label={ag(a.pflege)} value={row(a.pflege)} sign="minus" ratePct={a.pflege.ratePct} />
      <R label={tl(a.insolvenzgeld.label)} value={row(a.insolvenzgeld)} sign="minus" ratePct={a.insolvenzgeld.ratePct} />
      <R label={tl(a.u1.label)} value={row(a.u1)} sign="minus" ratePct={a.u1.ratePct} />
      <R label={tl(a.u2.label)} value={row(a.u2)} sign="minus" ratePct={a.u2.ratePct} />
      <R label={tl(a.unfall.label)} value={row(a.unfall)} sign="minus" ratePct={a.unfall.ratePct} />
      <R label={tl(a.pauschsteuer.label)} value={row(a.pauschsteuer)} sign="minus" ratePct={a.pauschsteuer.ratePct} />
      <Separator className="my-1.5" />
        </>
      )}
      <R label={se ? t("r.profit") : t("r.bruttolohn")} value={result.gross} strong />
      <Separator className="my-1.5" />
      <R label={tl(result.tax.lohnsteuer.label)} value={row(result.tax.lohnsteuer)} sign="minus" />
      <R label={tl(result.tax.soli.label)} value={row(result.tax.soli)} sign="minus" />
      <R label={tl(result.tax.kirchensteuer.label)} value={row(result.tax.kirchensteuer)} sign="minus" ratePct={result.tax.kirchensteuer.ratePct} />
      <R label={se ? tl(e.rente.label) : an(e.rente)} value={row(e.rente)} sign="minus" ratePct={e.rente.ratePct} />
      <R label={an(e.arbeitslosen)} value={row(e.arbeitslosen)} sign="minus" ratePct={e.arbeitslosen.ratePct} />
      <R label={se ? tl(e.kranken.label) : an(e.kranken)} value={row(e.kranken)} sign="minus" ratePct={e.kranken.ratePct} />
      <R label={se ? tl(e.pflege.label) : an(e.pflege)} value={row(e.pflege)} sign="minus" ratePct={e.pflege.ratePct} />
      {result.privateHealthEmployee && (
        <R label={tl(result.privateHealthEmployee.label)} value={row(result.privateHealthEmployee)} sign="minus" />
      )}
      <Separator className="my-1.5" />
      <R label={t("r.netto")} value={result.net} strong accent="net" />
      <R
        label={t("r.steuernAbgaben")}
        value={{
          monthly: result.employerTotalCost.monthly - result.net.monthly,
          yearly: result.employerTotalCost.yearly - result.net.yearly,
        }}
        strong
        accent="burden"
      />
    </div>
  );
}

export function ResultsPanel({ scenarioKey }: { scenarioKey: ScenarioKey }) {
  const t = useT();
  const result = useResult(scenarioKey);
  const primary = useCalcStore((s) => s.display);

  // The employer's total cost is the 100% reference.
  const base = result.employerTotalCost;
  const share = (v: { monthly: number; yearly: number }) =>
    formatShare(v.monthly, base.monthly);

  return (
    <div className="grid gap-4">
      {result.meta.proposal && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <div className="font-semibold">{t("r.proposal")}</div>
            <div className="mt-0.5 leading-snug">{t("se.warning")}</div>
          </div>
        </div>
      )}
      {/* Hero stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label={result.meta.selfEmployed ? t("r.profit") : t("r.brutto")}
          value={result.gross}
          primary={primary}
          share={share(result.gross)}
          accent="gross"
        />
        <StatTile
          label={t("r.nettoAN")}
          value={result.net}
          primary={primary}
          share={share(result.net)}
          accent="net"
        />
        {result.meta.selfEmployed ? (
          <StatTile
            label={t("r.abgaben")}
            value={{
              monthly: result.gross.monthly - result.net.monthly,
              yearly: result.gross.yearly - result.net.yearly,
            }}
            primary={primary}
            share={formatShare(result.gross.monthly - result.net.monthly, base.monthly)}
            accent="cost"
          />
        ) : (
          <StatTile
            label={t("r.agKosten")}
            value={result.employerTotalCost}
            primary={primary}
            share={share(result.employerTotalCost)}
            accent="cost"
          />
        )}
      </div>

      {/* Flow bar (full chain) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t("r.flowTitle")}</CardTitle>
          <div className="flex items-center gap-2">
            {result.meta.approximate && (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <Info className="h-3 w-3" /> {t("r.approx")}
              </Badge>
            )}
            {result.meta.provisional && (
              <Badge
                variant="outline"
                className="gap-1 text-amber-600"
                title={t("r.provisionalHint")}
              >
                <Info className="h-3 w-3" /> {t("r.provisional")}
              </Badge>
            )}
            <Badge variant="secondary">{result.meta.year}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CompositionBar result={result} period={primary} />
        </CardContent>
      </Card>

      {/* Unified breakdown panel: donut + table, then progression curve */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("r.breakdownTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <BreakdownDonut result={result} period={primary} />
            <div>
              <UnifiedTable result={result} primary={primary} />
            </div>
          </div>
          <Separator />
          <ProgressionChart scenarioKey={scenarioKey} />
        </CardContent>
      </Card>
    </div>
  );
}
