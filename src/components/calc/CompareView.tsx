import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScenarioForm } from "./ScenarioForm";
import { CompositionBar } from "./Charts";
import { MoneyPair } from "./Money";
import { useResult } from "./shared";
import { useCalcStore, type ScenarioKey, type DisplayPeriod } from "@/lib/store";
import { formatShare } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { CalculationResult } from "@/lib/tax/types";

function MiniStat({
  label,
  value,
  primary,
  share,
  accent,
}: {
  label: string;
  value: { monthly: number; yearly: number };
  primary: DisplayPeriod;
  share?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <MoneyPair
        monthly={value.monthly}
        yearly={value.yearly}
        primary={primary}
        share={share}
        align="left"
        className={accent ? "text-emerald-600 dark:text-emerald-500" : ""}
      />
    </div>
  );
}

function Side({ scenarioKey, label }: { scenarioKey: ScenarioKey; label: string }) {
  const t = useT();
  const result = useResult(scenarioKey);
  const primary = useCalcStore((s) => s.display);
  const formVersion = useCalcStore((s) => s.formVersion);
  const accentBar = scenarioKey === "A" ? "bg-sky-500" : "bg-violet-500";

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${accentBar}`} />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${accentBar}`}
          >
            {label}
          </span>
          {t("scenario")} {label}
          <Badge
            variant="secondary"
            className="ml-auto"
            title={result.meta.provisional ? t("r.provisionalHint") : undefined}
          >
            {result.meta.year}
            {result.meta.provisional && ` · ${t("r.provisional")}`}
          </Badge>
          {result.meta.proposal && (
            <Badge variant="outline" className="text-amber-600" title={t("se.warning")}>
              {t("r.proposal")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ScenarioForm key={`${scenarioKey}-${formVersion}`} scenarioKey={scenarioKey} />
        <Separator />
        <div className="grid grid-cols-3 gap-2">
          <MiniStat
            label={t("c.brutto")}
            value={result.gross}
            primary={primary}
            share={formatShare(result.gross.monthly, result.employerTotalCost.monthly)}
          />
          <MiniStat
            label={t("c.netto")}
            value={result.net}
            primary={primary}
            share={formatShare(result.net.monthly, result.employerTotalCost.monthly)}
            accent
          />
          <MiniStat
            label={result.meta.selfEmployed ? t("r.profit") : t("c.agKosten")}
            value={result.employerTotalCost}
            primary={primary}
            share={formatShare(
              result.employerTotalCost.monthly,
              result.employerTotalCost.monthly,
            )}
          />
        </div>
        <CompositionBar result={result} period={primary} />
      </CardContent>
    </Card>
  );
}

function DiffRow({
  label,
  a,
  b,
  aGross,
  bGross,
  primary,
  higherIsBetter = true,
}: {
  label: string;
  a: { monthly: number; yearly: number };
  b: { monthly: number; yearly: number };
  aGross: number;
  bGross: number;
  primary: DisplayPeriod;
  higherIsBetter?: boolean;
}) {
  const deltaM = b.monthly - a.monthly;
  const deltaY = b.yearly - a.yearly;
  const ref = primary === "monthly" ? deltaM : deltaY;
  const neutral = Math.abs(ref) < 0.005;
  const good = higherIsBetter ? ref > 0 : ref < 0;
  const color = neutral
    ? ""
    : good
      ? "text-emerald-600 dark:text-emerald-500"
      : "text-rose-600 dark:text-rose-500";
  // delta share = relative change vs. scenario A
  const deltaShare = formatShare(deltaM, Math.abs(a.monthly));
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-3 py-1.5 text-sm">
      <span className="pt-0.5 text-muted-foreground">{label}</span>
      <MoneyPair monthly={a.monthly} yearly={a.yearly} primary={primary} share={formatShare(a.monthly, aGross)} className="w-24 text-muted-foreground" />
      <MoneyPair monthly={b.monthly} yearly={b.yearly} primary={primary} share={formatShare(b.monthly, bGross)} className="w-24 text-muted-foreground" />
      <MoneyPair
        monthly={deltaM}
        yearly={deltaY}
        primary={primary}
        delta
        share={neutral ? undefined : deltaShare}
        className={`w-24 font-medium ${color}`}
      />
    </div>
  );
}

export function CompareView() {
  const t = useT();
  const primary = useCalcStore((s) => s.display);
  const a: CalculationResult = useResult("A");
  const b: CalculationResult = useResult("B");

  const common = {
    aGross: a.employerTotalCost.monthly,
    bGross: b.employerTotalCost.monthly,
    primary,
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Side scenarioKey="A" label="A" />
        <Side scenarioKey="B" label="B" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("compare.difference")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span />
            <span className="w-24 text-right">A</span>
            <span className="w-24 text-right">B</span>
            <span className="w-24 text-right">B − A</span>
          </div>
          <DiffRow label={t("r.netto")} a={a.net} b={b.net} {...common} />
          <DiffRow label={t("r.brutto")} a={a.gross} b={b.gross} {...common} />
          <DiffRow label={t("ch.steuern")} a={a.tax.total} b={b.tax.total} {...common} higherIsBetter={false} />
          <DiffRow label={t("ch.sozial")} a={a.employeeSocial.total} b={b.employeeSocial.total} {...common} higherIsBetter={false} />
          <DiffRow label={t("r.agKosten")} a={a.employerTotalCost} b={b.employerTotalCost} {...common} higherIsBetter={false} />
        </CardContent>
      </Card>
    </div>
  );
}
