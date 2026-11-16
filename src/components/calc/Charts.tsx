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
export const SLICE_COLORS = {
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
  /** part of `value` the employer pays on top of the agreed gross wage */
  employer: number;
}

function pickField(v: { monthly: number; yearly: number }, p: DisplayPeriod) {
  return p === "monthly" ? v.monthly : v.yearly;
}

/** Yearly amounts of the four destinations (Netto, Steuern, Sozialabgaben, Umlage). */
export function burdenParts(result: CalculationResult) {
  const e = result.employeeSocial;
  const a = result.employerSocial;
  return {
    net: result.net.yearly,
    steuern: result.tax.total.yearly + a.pauschsteuer.yearly,
    sozial:
      e.total.yearly +
      (result.privateHealthEmployee?.yearly ?? 0) +
      a.rente.yearly +
      a.arbeitslosen.yearly +
      a.kranken.yearly +
      a.pflege.yearly,
    umlage: a.insolvenzgeld.yearly + a.u1.yearly + a.u2.yearly + a.unfall.yearly,
    total: result.employerTotalCost.yearly,
  };
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
  const push = (key: string, label: string, value: number, color: string, employer = 0) => {
    if (value > 0.005) out.push({ key, label, value, color, employer: Math.min(employer, value) });
  };
  push("net", t("ch.net"), net, SLICE_COLORS.net);
  push("steuern", t("ch.steuern"), steuern, SLICE_COLORS.steuern, f(a.pauschsteuer));
  push(
    "sozial",
    t("ch.sozial"),
    sozial,
    SLICE_COLORS.sozial,
    f(a.rente) + f(a.arbeitslosen) + f(a.kranken) + f(a.pflege),
  );
  push("umlage", t("ch.umlage"), umlage, SLICE_COLORS.umlage, umlage);

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
  const employerTotal = slices.reduce((a, s) => a + s.employer, 0);

  // Hatched overlay for the employer's share on top of the gross wage. The
  // angles replicate Recharts' layout (full circle, paddingAngle between all
  // sectors) so the hatching sits exactly at the end of its slice.
  const PAD = 1.5;
  const sum = slices.reduce((a, s) => a + s.value, 0);
  const realTotal = 360 - slices.length * PAD;
  const overlays: { key: string; start: number; end: number }[] = [];
  let angle = 0;
  slices.forEach((s, i) => {
    const start = i === 0 ? 0 : angle + PAD;
    const span = sum > 0 ? (s.value / sum) * realTotal : 0;
    const end = start + span;
    if (s.employer > 0.005) {
      overlays.push({ key: s.key, start: end - span * (s.employer / s.value), end });
    }
    angle = end;
  });

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
          <defs>
            <pattern
              id="employer-hatch"
              patternUnits="userSpaceOnUse"
              width="5"
              height="5"
              patternTransform="rotate(45)"
            >
              <rect width="5" height="5" fill="rgba(0,0,0,0.18)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.75)" strokeWidth="1.6" />
            </pattern>
          </defs>
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
            paddingAngle={PAD}
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
          {overlays.map((o) => (
            <Pie
              key={`hatch-${o.key}`}
              data={[{ key: `hatch-${o.key}`, value: 1 }]}
              dataKey="value"
              startAngle={o.start}
              endAngle={o.end}
              innerRadius="62%"
              outerRadius="100%"
              fill="url(#employer-hatch)"
              stroke="none"
              isAnimationActive={false}
              legendType="none"
              tooltipType="none"
              style={{ pointerEvents: "none" }}
            />
          ))}
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
      {employerTotal > 0.005 && (
        <li className="flex items-center gap-2 border-t pt-1">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-muted-foreground"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.8) 0 1.5px, transparent 1.5px 3.5px)",
            }}
          />
          <span className="text-muted-foreground">{t("ch.employerShare")}</span>
          <span className="ml-auto font-mono tabular-nums">{formatEUR(employerTotal)}</span>
          <span className="w-9 text-right text-[10px] text-muted-foreground">
            {formatShare(employerTotal, total)}
          </span>
        </li>
      )}
    </ul>
    </div>
  );
}
