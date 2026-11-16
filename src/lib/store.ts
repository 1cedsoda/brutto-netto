import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScenarioInput } from "./tax/types";
import { currentTaxYear, getConstants } from "./tax/constants";

export type ScenarioKey = "A" | "B";
export type DisplayPeriod = "monthly" | "yearly";
export type Lang = "de" | "en";
export type Theme = "light" | "dark" | "system";

// German-average defaults (also used as the benchmark curve):
// ~4.300 €/Monat brutto, Steuerklasse I, NRW, GKV (Ø-Zusatzbeitrag), Alter 43.
// The tax year defaults to the current calendar year (clamped to the supported years).
const DEFAULT_YEAR = currentTaxYear();

export const defaultScenario: ScenarioInput = {
  year: DEFAULT_YEAR,
  grossPeriod: "monthly",
  grossAmount: 4300,
  steuerklasse: 1,
  bundesland: "NW",
  church: false,
  children: 0,
  age: 43,
  pensionInsured: true,
  minijob: false,
  selfEmployed: false,
  rvProposal: "gruender",
  health: {
    kind: "gkv",
    zusatzbeitragPct: getConstants(DEFAULT_YEAR).defaultZusatz,
    fundId: "average",
    privateMonthlyPremium: 600,
    basisPct: 85,
  },
  employer: {
    insolvenzgeld: true, // U3
    u1Pct: 1.1, // U1 (Entgeltfortzahlung Krankheit) — on by default
    u2Pct: 0.5, // U2 (Mutterschaftsumlage) — on by default
    unfallPct: 1.3, // Unfallversicherung (BG) — on by default
  },
};

/** A blank scenario (used by the "Zurücksetzen" / clear action). */
export const emptyScenario: ScenarioInput = {
  ...defaultScenario,
  grossAmount: 0,
  church: false,
  children: 0,
  minijob: false,
  selfEmployed: false,
  health: { kind: "gkv", zusatzbeitragPct: 0, fundId: "custom", privateMonthlyPremium: 0, basisPct: 85 },
  employer: { insolvenzgeld: false, u1Pct: 0, u2Pct: 0, unfallPct: 0 },
};

function withoutYear(sc: ScenarioInput): Omit<ScenarioInput, "year"> {
  const { year: _year, ...rest } = sc;
  return rest;
}

interface CalcState {
  scenarioA: ScenarioInput;
  scenarioB: ScenarioInput;
  compareMode: boolean;
  /** Whether results are shown per month or per year */
  display: DisplayPeriod;
  /** UI language */
  lang: Lang;
  /** Colour theme */
  theme: Theme;
  /**
   * Bumped whenever a scenario is replaced from *outside* the form (reset, swap,
   * copy). The forms key off this so they re-initialise from the new values.
   */
  formVersion: number;

  /** Replace a whole scenario — used by the TanStack form's change listener. */
  setScenario: (key: ScenarioKey, value: ScenarioInput) => void;
  /** Load the recommended defaults. */
  reset: (key: ScenarioKey) => void;
  /** Clear to a blank scenario. */
  clear: (key: ScenarioKey) => void;
  copyAToB: () => void;
  swap: () => void;
  setCompareMode: (v: boolean) => void;
  setDisplay: (d: DisplayPeriod) => void;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

export const useCalcStore = create<CalcState>()(
  persist(
    (set) => ({
      scenarioA: defaultScenario,
      scenarioB: { ...defaultScenario, grossAmount: 4500, steuerklasse: 3 },
      compareMode: false,
      display: "monthly",
      lang: "de",
      theme: "system",
      formVersion: 0,

      setScenario: (key, value) =>
        set(() => ({ [key === "A" ? "scenarioA" : "scenarioB"]: value })),
      reset: (key) =>
        set((s) => ({
          [key === "A" ? "scenarioA" : "scenarioB"]: defaultScenario,
          formVersion: s.formVersion + 1,
        })),
      clear: (key) =>
        set((s) => ({
          [key === "A" ? "scenarioA" : "scenarioB"]: emptyScenario,
          formVersion: s.formVersion + 1,
        })),
      copyAToB: () =>
        set((s) => ({ scenarioB: { ...s.scenarioA }, formVersion: s.formVersion + 1 })),
      swap: () =>
        set((s) => ({
          scenarioA: s.scenarioB,
          scenarioB: s.scenarioA,
          formVersion: s.formVersion + 1,
        })),
      setCompareMode: (v) => set({ compareMode: v }),
      setLang: (l) => set({ lang: l }),
      setTheme: (t) => set({ theme: t }),
      setDisplay: (d) =>
        set((s) => {
          if (d === s.display) return { display: d };
          // Keep the income input in sync with the chosen period and convert the
          // entered amount so it represents the same salary (e.g. 3.500/M → 42.000/J).
          const convert = (sc: ScenarioInput): ScenarioInput => {
            if (sc.grossPeriod === d) return sc;
            const factor = d === "yearly" ? 12 : 1 / 12;
            return {
              ...sc,
              grossPeriod: d,
              grossAmount: Math.round(sc.grossAmount * factor * 100) / 100,
            };
          };
          return {
            display: d,
            scenarioA: convert(s.scenarioA),
            scenarioB: convert(s.scenarioB),
            formVersion: s.formVersion + 1,
          };
        }),
    }),
    {
      name: "brutto-netto-2025",
      version: 7,
      // The tax year is deliberately not persisted: every visit starts in the
      // current calendar year (see `merge`).
      partialize: (s) => ({
        scenarioA: withoutYear(s.scenarioA),
        scenarioB: withoutYear(s.scenarioB),
        compareMode: s.compareMode,
        display: s.display,
        lang: s.lang,
        theme: s.theme,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CalcState>;
        const withYear = (sc: ScenarioInput | undefined, fallback: ScenarioInput) =>
          sc ? { ...fallback, ...sc, year: DEFAULT_YEAR } : fallback;
        return {
          ...current,
          ...p,
          scenarioA: withYear(p.scenarioA, current.scenarioA),
          scenarioB: withYear(p.scenarioB, current.scenarioB),
        };
      },
      migrate: (persisted: unknown, version) => {
        const s = persisted as Partial<CalcState> | undefined;
        if (!s) return persisted as CalcState;
        const display: DisplayPeriod = s.display ?? "monthly";
        const fix = (sc: ScenarioInput | undefined) => {
          if (!sc) return;
          if (version < 2 && !sc.year) sc.year = 2025;
          if (version < 3) {
            // Map old health-insurance kinds to the new GKV/PKV scheme.
            const k = sc.health?.kind as unknown as string;
            if (k === "statutory") sc.health.kind = "gkv";
            else if (k === "private") sc.health.kind = "pkv_zuschuss";
            else if (k === "private_5050") sc.health.kind = "pkv";
            // Keep the income period aligned with the global display.
            if (sc.grossPeriod !== display) {
              const factor = display === "yearly" ? 12 : 1 / 12;
              sc.grossAmount = Math.round(sc.grossAmount * factor * 100) / 100;
              sc.grossPeriod = display;
            }
          }
          if (version < 4 && sc.minijob === undefined) sc.minijob = false;
          if (version < 6 && sc.health && sc.health.basisPct === undefined) {
            sc.health.basisPct = 85;
          }
          if (version < 7) {
            if (sc.selfEmployed === undefined) sc.selfEmployed = false;
            if (sc.rvProposal === undefined) sc.rvProposal = "gruender";
          }
        };
        fix(s.scenarioA);
        fix(s.scenarioB);
        return s as CalcState;
      },
    },
  ),
);
