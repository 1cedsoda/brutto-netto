import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CalculationResult } from "@/lib/tax/types";
import type { DisplayPeriod } from "@/lib/store";
import { formatEUR, formatShare } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";

// Four high-level destinations of the total employer cost — no AN/AG split.
const C = {
  net: "#10b981", // emerald
  steuern: "#f59e0b", // amber
  sozial: "#0ea5e9", // sky
  umlage: "#64748b", // slate
};

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function pickField(v: { monthly: number; yearly: number }, p: DisplayPeriod) {
  return p === "monthly" ? v.monthly : v.yearly;
}

/**
 * Split the total employer cost into Netto, Steuern, Sozialabgaben and Umlage.
 * Employee and employer contributions of the same kind are combined.
 */
function buildSlices(
  result: CalculationResult,
  period: DisplayPeriod,
  t: (k: Key) => string,
): { slices: Slice[]; total: number; totalLabel: string } {
  const f = (v: { monthly: number; yearly: number }) => pickField(v, period);
  const e = result.employeeSocial;
  const a = result.employerSocial;
  const pkvEmployee = result.privateHealthEmployee ? f(result.privateHealthEmployee) : 0;

  const net = f(result.net);
  // Pauschsteuer (Minijob) is a tax; the rest of the employer levies are Umlagen.
  const steuern = f(result.tax.total) + f(a.pauschsteuer);
  const sozial =
    f(e.total) +
    pkvEmployee +
    f(a.rente) +
    f(a.arbeitslosen) +
    f(a.kranken) +
    f(a.pflege);
  const umlage = f(a.insolvenzgeld) + f(a.u1) + f(a.u2) + f(a.unfall);

  const out: Slice[] = [];
  const push = (key: string, label: string, value: number, color: string) => {
    if (value > 0.005) out.push({ key, label, value, color });
  };
  push("net", t("ch.net"), net, C.net);
  push("steuern", t("ch.steuern"), steuern, C.steuern);
  push("sozial", t("ch.sozial"), sozial, C.sozial);
  push("umlage", t("ch.umlage"), umlage, C.umlage);

  return {
    slices: out,
    total: f(result.employerTotalCost),
    totalLabel: result.meta.selfEmployed ? t("r.brutto") : t("ch.agKosten"),
  };
}

const toConfig = (slices: Slice[]): ChartConfig =>
  Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }]));

/** Horizontal stacked composition bar (CSS — exact share widths). */
export function CompositionBar({
  result,
  period,
}: {
  result: CalculationResult;
  period: DisplayPeriod;
}) {
  const t = useT();
  const { slices, total } = buildSlices(result, period, t);

  return (
    <div className="space-y-3">
      <div className="flex h-14 w-full overflow-hidden rounded-lg">
        {slices.map((s) => {
          const frac = total > 0 ? s.value / total : 0;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${formatEUR(s.value)} · ${formatShare(s.value, total)}`}
              className="flex min-w-0 items-center justify-center"
              style={{
                width: `${frac * 100}%`,
                background: s.color,
                boxShadow: "inset -1.5px 0 0 var(--card)",
              }}
            >
              {frac > 0.05 && (
                <span className="truncate px-1 text-[11px] font-semibold text-white">
                  {formatShare(s.value, total)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
            />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-mono tabular-nums">{formatEUR(s.value)}</span>
            <span className="w-10 text-right font-mono tabular-nums text-muted-foreground/70">
              {formatShare(s.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Donut of the four destinations, total in the centre. */
export function BreakdownDonut({
  result,
  period,
}: {
  result: CalculationResult;
  period: DisplayPeriod;
}) {
  const t = useT();
  const { slices, total, totalLabel } = buildSlices(result, period, t);
  const config = toConfig(slices);

  const renderPieLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    value?: number;
  }) => {
    const cx = Number(props.cx ?? 0);
    const cy = Number(props.cy ?? 0);
    const midAngle = Number(props.midAngle ?? 0);
    const innerRadius = Number(props.innerRadius ?? 0);
    const outerRadius = Number(props.outerRadius ?? 0);
    const value = Number(props.value ?? 0);
    if (value / total < 0.06) return null;
    const RAD = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {formatShare(value, total)}
      </text>
    );
  };

  return (
    <div className="grid gap-3">
    <div className="relative mx-auto aspect-square w-full max-w-[200px]">
      <ChartContainer config={config} className="aspect-square h-full w-full">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>{config[name as string]?.label ?? name}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatEUR(Number(value))}
                      <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                        {formatShare(Number(value), total)}
                      </span>
                    </span>
                  </div>
                )}
              />
            }
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="key"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={1.5}
            stroke="var(--card)"
            strokeWidth={1}
            label={renderPieLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] text-muted-foreground">{totalLabel}</span>
        <span className="font-mono text-base font-semibold tabular-nums">
          {formatEUR(total)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {period === "monthly" ? t("m.perMonth") : t("m.perYear")}
        </span>
      </div>
    </div>
    <ul className="grid gap-1 text-xs">
      {slices.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
          <span className="text-muted-foreground">{s.label}</span>
          <span className="ml-auto font-mono tabular-nums">{formatEUR(s.value)}</span>
          <span className="w-9 text-right text-[10px] text-muted-foreground">
            {formatShare(s.value, total)}
          </span>
        </li>
      ))}
    </ul>
    </div>
  );
}
