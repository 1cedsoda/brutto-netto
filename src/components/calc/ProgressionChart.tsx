import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { SLICE_COLORS, burdenParts } from "./Charts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { calculateScenario } from "@/lib/tax/scenario";
import type { ScenarioInput } from "@/lib/tax/types";
import { getConstants } from "@/lib/tax/constants";
import { useCalcStore, defaultScenario, type ScenarioKey } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { formatEUR0, formatShare } from "@/lib/format";

/**
 * Personalised burden curve: taxes + all contributions as a share of the total
 * employer cost (AG-Kosten), across a range of incomes, everything else fixed.
 * The benchmark line is the German-average defaults at the same tax year.
 */
export function ProgressionChart({ scenarioKey }: { scenarioKey: ScenarioKey }) {
  const t = useT();
  const scenario = useCalcStore((s) =>
    scenarioKey === "A" ? s.scenarioA : s.scenarioB,
  );
  const monthly = scenario.grossPeriod === "monthly";
  // The main job is varied; all further jobs stay fixed. X axis = total gross.
  const others = scenario.jobs.slice(1).reduce((a, j) => a + j.grossAmount, 0);
  const current = (scenario.jobs[0]?.grossAmount ?? 0) + others;

  const { data, minX, maxX, highest } = useMemo(() => {
    const limit = getConstants(scenario.year).minijobLimit; // €/month
    // Fixed axis (independent of further jobs): from the Minijob limit up to
    // 10.000 €/Monat. The main job is varied from the limit upwards, so with
    // further jobs the curve simply starts further right.
    const min = monthly ? limit : limit * 12;
    const max = Math.max(monthly ? 10000 : 120000, current);
    const steps = 60;

    const benchScenario: ScenarioInput = {
      ...defaultScenario,
      year: scenario.year,
      grossPeriod: scenario.grossPeriod,
    };
    const resultFor = (sc: ScenarioInput, total: number, fixed: number) => {
      const [main, ...rest] = sc.jobs;
      return calculateScenario({
        ...sc,
        jobs: [
          {
            ...main,
            kind: main.kind === "minijob" ? "employee" : main.kind,
            grossAmount: Math.max(0, total - fixed),
          },
          ...rest,
        ],
      }).total;
    };
    // Shares of the total cost (AG-Kosten): taxes, social contributions, levies.
    const pct = (v: number, base: number) => (base > 0 ? (v / base) * 100 : 0);

    const pts: {
      x: number;
      steuern: number | null;
      sozial: number | null;
      umlage: number | null;
      rate: number | null;
      benchmark: number;
    }[] = [];
    let highest = 0;
    const own = (g: number) => {
      const p = burdenParts(resultFor(scenario, g, others));
      return {
        steuern: pct(p.steuern, p.total),
        sozial: pct(p.sozial, p.total),
        umlage: pct(p.umlage, p.total),
      };
    };
    const start = min + others; // main job at the Minijob limit
    for (let i = 0; i <= steps; i++) {
      const g = min + ((max - min) / steps) * i; // linear income axis
      const b = burdenParts(resultFor(benchScenario, g, 0));
      const benchmark = pct(b.total - b.net, b.total);
      const mine = g >= start ? own(g) : null;
      const steuern = mine?.steuern ?? null;
      const sozial = mine?.sozial ?? null;
      const umlage = mine?.umlage ?? null;
      const rate = mine ? mine.steuern + mine.sozial + mine.umlage : null;
      highest = Math.max(highest, rate ?? 0, benchmark);
      pts.push({ x: g, steuern, sozial, umlage, rate, benchmark });
    }
    return { data: pts, minX: min, maxX: max, highest };
  }, [scenario, monthly, current, others]);

  // Linear Y axis from 0 % (stacked areas need a zero baseline).
  const yMax = Math.min(100, Math.max(60, Math.ceil(highest / 10) * 10));
  const yTicks = Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10);

  const config: ChartConfig = {
    steuern: { label: t("ch.steuern"), color: SLICE_COLORS.steuern },
    sozial: { label: t("ch.sozial"), color: SLICE_COLORS.sozial },
    umlage: { label: t("ch.umlage"), color: SLICE_COLORS.umlage },
    rate: { label: t("r.you"), color: "currentColor" },
    benchmark: { label: t("r.benchmark"), color: "#94a3b8" },
  };
  const legend: { key: keyof typeof config; dashed?: boolean }[] = [
    { key: "steuern" },
    { key: "sozial" },
    { key: "umlage" },
    { key: "benchmark", dashed: true },
  ];

  return (
    <div>
      <div className="mb-2 grid gap-1">
        <span className="text-sm font-medium">{t("r.progression")}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {legend.map(({ key, dashed }) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-3 rounded-[2px]"
                style={
                  dashed
                    ? { borderTop: `2px dashed ${config[key].color}`, height: 0 }
                    : { background: config[key].color }
                }
              />
              {config[key].label}
            </span>
          ))}
        </span>
      </div>
      <ChartContainer config={config} className="!aspect-auto h-[200px] w-full">
        <ComposedChart data={data} margin={{ left: 4, right: 10, top: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[minX, maxX]}
            tickFormatter={(v) => formatEUR0(Number(v))}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            fontSize={11}
            minTickGap={24}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(v) => `${v} %`}
            width={40}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  formatEUR0(Number(p?.[0]?.payload?.x ?? 0)) +
                  (monthly ? " / M" : " / J")
                }
                formatter={(value, name, item) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-[2px]"
                        style={{ background: config[name as string]?.color }}
                      />
                      {config[name as string]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatShare(Number(value), 100)}
                      {name === "steuern" && (
                        <span className="ml-2 font-sans text-foreground">
                          Σ {formatShare(Number(item?.payload?.rate ?? 0), 100)}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              />
            }
          />
          {current >= minX && current <= maxX && (
            <ReferenceLine
              x={current}
              stroke="var(--color-emerald-500, #10b981)"
              strokeDasharray="4 3"
              label={{
                value: t("r.you"),
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--color-emerald-600, #059669)",
              }}
            />
          )}
          <Line
            dataKey="benchmark"
            type="monotone"
            stroke="var(--color-benchmark)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          {(["umlage", "sozial", "steuern"] as const).map((k) => (
            <Area
              key={k}
              dataKey={k}
              stackId="burden"
              type="monotone"
              stroke={`var(--color-${k})`}
              fill={`var(--color-${k})`}
              fillOpacity={0.55}
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
