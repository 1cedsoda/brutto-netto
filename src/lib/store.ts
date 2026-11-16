import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EmployerExtras, Job, JobKind, ScenarioInput } from "./tax/types";
import { currentTaxYear, getConstants } from "./tax/constants";

export type ScenarioKey = "A" | "B";
export type DisplayPeriod = "monthly" | "yearly";
export type Lang = "de" | "en";
export type Theme = "light" | "dark" | "system";

// German-average defaults (also used as the benchmark curve):
// ~4.300 €/Monat brutto, Steuerklasse I, NRW, GKV (Ø-Zusatzbeitrag), Alter 43.
// The tax year defaults to the current calendar year (clamped to the supported years).
const DEFAULT_YEAR = currentTaxYear();

export const defaultEmployer: EmployerExtras = {
  insolvenzgeld: true, // U3
  u1Pct: 1.1, // U1 (Entgeltfortzahlung Krankheit) — on by default
  u2Pct: 0.5, // U2 (Mutterschaftsumlage) — on by default
  unfallPct: 1.3, // Unfallversicherung (BG) — on by default
};

let jobCounter = 0;
export const newJobId = () => `j${Date.now().toString(36)}${(jobCounter++).toString(36)}`;

export function newJob(kind: JobKind, grossAmount: number): Job {
  return { id: newJobId(), kind, grossAmount, employer: { ...defaultEmployer } };
}

/** Default amount (per month) when adding a further job of a kind. */
export const ADD_JOB_MONTHLY: Record<JobKind, number> = {
  employee: 1500,
  minijob: 400,
  self: 1000,
};

export const defaultScenario: ScenarioInput = {
  year: DEFAULT_YEAR,
  grossPeriod: "monthly",
  steuerklasse: 1,
  bundesland: "NW",
  church: false,
  children: 0,
  age: 43,
  pensionInsured: true,
  rvCommission: false,
  rvProposal: "gruender",
  health: {
    kind: "gkv",
    zusatzbeitragPct: getConstants(DEFAULT_YEAR).defaultZusatz,
    fundId: "average",
    privateMonthlyPremium: 600,
    basisPct: 85,
  },
  jobs: [{ id: "main", kind: "employee", grossAmount: 4300, employer: { ...defaultEmployer } }],
};

/** A blank scenario (used by the "Zurücksetzen" / clear action). */
export const emptyScenario: ScenarioInput = {
  ...defaultScenario,
  church: false,
  children: 0,
  health: { kind: "gkv", zusatzbeitragPct: 0, fundId: "custom", privateMonthlyPremium: 0, basisPct: 85 },
  jobs: [
    {
      id: "main",
      kind: "employee",
      grossAmount: 0,
      employer: { insolvenzgeld: false, u1Pct: 0, u2Pct: 0, unfallPct: 0 },
    },
  ],
};

function withoutYear(sc: ScenarioInput): Omit<ScenarioInput, "year"> {
  const { year: _year, ...rest } = sc;
  return rest;
}

export type FormSection = "personTax" | "income" | "social";

/** Default values for the fields of one form section. */
function sectionDefaults(section: FormSection, current: ScenarioInput): Partial<ScenarioInput> {
  const d = defaultScenario;
  switch (section) {
    case "personTax":
      return {
        year: d.year,
        steuerklasse: d.steuerklasse,
        bundesland: d.bundesland,
        age: d.age,
        children: d.children,
        church: d.church,
      };
    case "income": {
      // One default main job; keep the chosen period.
      const f = current.grossPeriod === "yearly" ? 12 : 1;
      return {
        jobs: d.jobs.map((j) => ({ ...j, grossAmount: j.grossAmount * f, employer: { ...j.employer } })),
        rvCommission: d.rvCommission,
        rvProposal: d.rvProposal,
      };
    }
    case "social":
      return {
        health: { ...d.health },
        pensionInsured: d.pensionInsured,
      };
  }
}

/** Convert a pre-multi-job (flat) scenario into the job-list model. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateLegacy(sc: any): ScenarioInput {
  if (Array.isArray(sc.jobs)) return sc as ScenarioInput;
  const kind: JobKind = sc.selfEmployed ? "self" : sc.minijob ? "minijob" : "employee";
  const { grossAmount, minijob: _m, selfEmployed: _s, employer, ...rest } = sc;
  return {
    ...defaultScenario,
    ...rest,
    rvCommission: sc.rvCommission ?? false,
    rvProposal: sc.rvProposal ?? "gruender",
    jobs: [
      {
        id: "main",
        kind,
        grossAmount: grossAmount ?? 0,
        employer: { ...defaultEmployer, ...(employer ?? {}) },
      },
    ],
  };
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
  /** Add a further job (amount in the scenario's period). */
  addJob: (key: ScenarioKey, kind?: JobKind) => void;
  removeJob: (key: ScenarioKey, id: string) => void;
  setJobKind: (key: ScenarioKey, id: string, kind: JobKind) => void;
  /** Reset the fields of a single form section to their defaults. */
  resetSection: (key: ScenarioKey, section: FormSection) => void;
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
      scenarioB: {
        ...defaultScenario,
        steuerklasse: 3,
        jobs: [{ ...defaultScenario.jobs[0], grossAmount: 4500 }],
      },
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
      addJob: (key, kind = "employee") =>
        set((s) => {
          const prop = key === "A" ? "scenarioA" : "scenarioB";
          const sc = s[prop];
          // Only one self-employment per person (all self-employed income combined).
          const k: JobKind = kind === "self" && sc.jobs.some((j) => j.kind === "self") ? "employee" : kind;
          const f = sc.grossPeriod === "yearly" ? 12 : 1;
          return {
            [prop]: { ...sc, jobs: [...sc.jobs, newJob(k, ADD_JOB_MONTHLY[k] * f)] },
            formVersion: s.formVersion + 1,
          };
        }),
      removeJob: (key, id) =>
        set((s) => {
          const prop = key === "A" ? "scenarioA" : "scenarioB";
          const sc = s[prop];
          if (sc.jobs.length <= 1) return {};
          return {
            [prop]: { ...sc, jobs: sc.jobs.filter((j) => j.id !== id) },
            formVersion: s.formVersion + 1,
          };
        }),
      setJobKind: (key, id, kind) =>
        set((s) => {
          const prop = key === "A" ? "scenarioA" : "scenarioB";
          const sc = s[prop];
          if (kind === "self" && sc.jobs.some((j) => j.kind === "self" && j.id !== id)) return {};
          return {
            [prop]: { ...sc, jobs: sc.jobs.map((j) => (j.id === id ? { ...j, kind } : j)) },
            formVersion: s.formVersion + 1,
          };
        }),
      resetSection: (key, section) =>
        set((s) => {
          const prop = key === "A" ? "scenarioA" : "scenarioB";
          const current = s[prop];
          return {
            [prop]: { ...current, ...sectionDefaults(section, current) },
            formVersion: s.formVersion + 1,
          };
        }),
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
              jobs: sc.jobs.map((j) => ({
                ...j,
                grossAmount: Math.round(j.grossAmount * factor * 100) / 100,
              })),
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
      version: 9,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fix = (sc: any) => {
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
          if (version < 8 && sc.rvCommission === undefined) sc.rvCommission = false;
        };
        fix(s.scenarioA);
        fix(s.scenarioB);
        // v9: multi-job model
        if (s.scenarioA) s.scenarioA = migrateLegacy(s.scenarioA);
        if (s.scenarioB) s.scenarioB = migrateLegacy(s.scenarioB);
        return s as CalcState;
      },
    },
  ),
);
