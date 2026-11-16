import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
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

  const { data, minX, maxX, lowest } = useMemo(() => {
    const limit = getConstants(scenario.year).minijobLimit; // €/month
    const min = (monthly ? limit : limit * 12) + others;
    const top = (monthly ? 10000 : 120000) + others;
    const max = Math.max(top, current);
    const steps = 60;

    const benchScenario: ScenarioInput = {
      ...defaultScenario,
      year: scenario.year,
      grossPeriod: scenario.grossPeriod,
    };
    // Burden = (AG total cost − net) / AG total cost.
    const rateOf = (sc: ScenarioInput, total: number, fixed: number) => {
      const [main, ...rest] = sc.jobs;
      const r = calculateScenario({
        ...sc,
        jobs: [
          { ...main, kind: main.kind === "minijob" ? "employee" : main.kind, grossAmount: Math.max(0, total - fixed) },
          ...rest,
        ],
      }).total;
      const cost = r.employerTotalCost.monthly;
      return cost > 0 ? ((cost - r.net.monthly) / cost) * 100 : 0;
    };

    const pts: { x: number; rate: number; benchmark: number }[] = [];
    let lowest = Infinity;
    for (let i = 0; i <= steps; i++) {
      const g = min + ((max - min) / steps) * i; // linear income axis
      const rate = rateOf(scenario, g, others);
      const benchmark = rateOf(benchScenario, g, 0);
      lowest = Math.min(lowest, rate, benchmark);
      pts.push({ x: g, rate, benchmark });
    }
    return { data: pts, minX: min, maxX: max, lowest };
  }, [scenario, monthly, current, others]);

  // Logarithmic Y axis, normally 30–60 %, extended downwards if a curve dips lower.
  const yMin = Math.max(5, Math.min(30, Math.floor(lowest / 5) * 5));
  const yTicks = [5, 10, 15, 20, 25, 30, 40, 50, 60].filter(
    (v) => v >= yMin && v <= 60,
  );

  const config: ChartConfig = {
    rate: { label: t("r.you"), color: "#0ea5e9" },
    benchmark: { label: t("r.benchmark"), color: "#94a3b8" },
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{t("r.progression")}</span>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-[2px]" style={{ background: "#0ea5e9" }} />
            {t("r.you")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-[2px]" style={{ background: "#94a3b8" }} />
            {t("r.benchmark")}
          </span>
        </span>
      </div>
      <ChartContainer config={config} className="!aspect-auto h-[200px] w-full">
        <LineChart data={data} margin={{ left: 4, right: 10, top: 12, bottom: 0 }}>
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
            scale="log"
            domain={[yMin, 60]}
            ticks={yTicks}
            allowDataOverflow
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
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {config[name as string]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatShare(Number(value), 100)}
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
          <Line
            dataKey="rate"
            type="monotone"
            stroke="var(--color-rate)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
