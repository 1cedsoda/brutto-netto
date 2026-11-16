import { useMemo } from "react";
import { calculate } from "@/lib/tax/calculate";
import type { CalculationResult } from "@/lib/tax/types";
import { useCalcStore, type ScenarioKey } from "@/lib/store";

/** Semantic colours shared between charts and tables. */
export const SEGMENTS = {
  net: { label: "Netto", color: "var(--color-emerald-500, #10b981)" },
  tax: { label: "Steuern", color: "var(--color-amber-500, #f59e0b)" },
  socialAN: { label: "SV Arbeitnehmer", color: "var(--color-sky-500, #0ea5e9)" },
  socialAG: { label: "SV Arbeitgeber", color: "var(--color-slate-400, #94a3b8)" },
} as const;

export function useResult(key: ScenarioKey): CalculationResult {
  const scenario = useCalcStore((s) => (key === "A" ? s.scenarioA : s.scenarioB));
  return useMemo(() => calculate(scenario), [scenario]);
}

/** Pick monthly or yearly from a {monthly,yearly} pair based on the global toggle. */
export function pick(
  value: { monthly: number; yearly: number },
  period: "monthly" | "yearly",
): number {
  return period === "monthly" ? value.monthly : value.yearly;
}
