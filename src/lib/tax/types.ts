// Domain types for the German Brutto-Netto calculation.
// All monetary values in the public API are EUR (not cents).

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

export type GrossPeriod = "monthly" | "yearly";

/** German federal states — affects church tax rate (8% vs 9%) and Saxony's
 *  special long-term-care (Pflege) contribution split. */
export type Bundesland =
  | "BW" // Baden-Württemberg (KiSt 8%)
  | "BY" // Bayern (KiSt 8%)
  | "BE"
  | "BB"
  | "HB"
  | "HH"
  | "HE"
  | "MV"
  | "NI"
  | "NW"
  | "RP"
  | "SL"
  | "SN" // Sachsen (special Pflege split)
  | "ST"
  | "SH"
  | "TH";

/**
 * gkv          — gesetzliche Krankenversicherung (statutory)
 * pkv_zuschuss — private with the statutory employer subsidy (capped Höchstzuschuss)
 * pkv          — private without an employer subsidy (employee bears the full premium)
 */
export type HealthInsuranceKind = "gkv" | "pkv_zuschuss" | "pkv";

/**
 * Rentenkommission (Alterssicherungskommission, Bericht 23.06.2026, Empfehlung 22):
 * regel     — Regelbeitrag wie bei Handwerkern (Beitragssatz × Bezugsgröße)
 * gruender  — halber Regelbeitrag in den ersten drei Jahren nach Gründung
 * einkommen — einkommensbezogener Beitrag (Beitragssatz × Gewinn)
 */
export type RvProposal = "regel" | "gruender" | "einkommen";

export interface HealthInsurance {
  kind: HealthInsuranceKind;
  /** GKV: individual supplementary contribution rate (Zusatzbeitrag) in %, e.g. 2.5 */
  zusatzbeitragPct: number;
  /** GKV: chosen Krankenkasse id (for presets/labelling only) */
  fundId?: string;
  /** PKV: total monthly premium (KV + PV) the employee's policy costs */
  privateMonthlyPremium: number;
  /** PKV: deductible Basisabsicherung share of the premium, in % (default 85) */
  basisPct: number;
}

export interface EmployerExtras {
  /** Insolvenzgeldumlage (U3) — paid by virtually all employers */
  insolvenzgeld: boolean;
  /** Umlage U1 (Entgeltfortzahlung im Krankheitsfall) — only small firms; rate in % */
  u1Pct: number;
  /** Umlage U2 (Mutterschaftsaufwendungen) — all employers; rate in % */
  u2Pct: number;
  /** Gesetzliche Unfallversicherung (Berufsgenossenschaft) — rate in % of gross */
  unfallPct: number;
}

import type { TaxYear } from "./constants";

export interface JobInput {
  /** Calendar year whose rules apply */
  year: TaxYear;
  grossPeriod: GrossPeriod;
  /** Gross salary expressed in the chosen period */
  grossAmount: number;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  /** Church tax member */
  church: boolean;
  /** Number of children (for Pflege discount/surcharge and child allowances) */
  children: number;
  /** Age in years — childless Pflege surcharge applies from 23 */
  age: number;
  /** Subject to statutory pension AND unemployment insurance (RV + ALV).
   *  For a Minijob this means the 3.6% pension top-up applies (no Befreiung). */
  pensionInsured: boolean;
  /** Geringfügige Beschäftigung (Minijob): flat-rate employer contributions,
   *  no employee tax/SV beyond the optional pension top-up. */
  minijob: boolean;
  /** Selbstständig / Gründer:in — computed with the pension-insurance duty for
   *  self-employed people as PROPOSED by the Rentenkommission (not current law).
   *  `grossAmount` is then the profit (Gewinn) before tax. */
  selfEmployed: boolean;
  /** Self-employed: apply the Rentenkommission proposal (mandatory pension
   *  insurance). Off = current law (no statutory pension insurance). */
  rvCommission: boolean;
  /** Pension contribution variant of the Rentenkommission proposal */
  rvProposal: RvProposal;
  health: HealthInsurance;
  employer: EmployerExtras;

  // ── Internal overrides set by the multi-job layer (scenario.ts) ──
  /** Share (0–1) of the contribution ceilings (BBG) attributed to this job when
   *  several jobs are subject to social insurance (§22 Abs. 2 SGB IV). */
  bbgShare?: number;
  /** Arbeitslosenversicherungsfrei (e.g. a Minijob added to a main job). */
  alvExempt?: boolean;
  /** Übergangsbereich: contribution bases as a share of the gross wage. */
  midijob?: { totalFactor: number; employeeFactor: number };
  /** Health/long-term care is covered via another job (no KV/PV/PKV here). */
  noHealth?: boolean;
  /** Self-employed: additional income counted for the voluntary GKV base. */
  kvExtraIncome?: number;
  /** Self-employed: compute income tax here (false when assessed jointly). */
  selfWithTax?: boolean;
}

// ── Multi-job scenario (public model) ───────────────────────────────────

export type JobKind = "employee" | "minijob" | "self";

export interface Job {
  id: string;
  kind: JobKind;
  /** Gross wage (employee/minijob) or gross income (self), in the scenario's period */
  grossAmount: number;
  /** Employer levies — employee / minijob only */
  employer: EmployerExtras;
}

/** A person with one or more jobs. Person-level settings apply to all jobs. */
export interface ScenarioInput {
  year: TaxYear;
  grossPeriod: GrossPeriod;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  church: boolean;
  children: number;
  age: number;
  /** Statutory pension + unemployment insurance for employments */
  pensionInsured: boolean;
  health: HealthInsurance;
  /** Self-employed: apply the Rentenkommission proposal (not current law) */
  rvCommission: boolean;
  rvProposal: RvProposal;
  /** jobs[0] is the main job; at most one job of kind "self" */
  jobs: Job[];
}

/** How a job is treated under the multi-job rules. */
export type JobTreatment =
  | "main" // Hauptbeschäftigung (persönliche Steuerklasse)
  | "side" // weitere Beschäftigung (Steuerklasse VI)
  | "midijob" // Übergangsbereich (Hauptjob)
  | "minijob" // geringfügig, pauschal
  | "minijob-combined" // Minijob, mit Hauptjob zusammengerechnet → SV-pflichtig
  | "self";

export interface JobResult {
  job: Job;
  index: number;
  treatment: JobTreatment;
  steuerklasse: Steuerklasse | null;
  result: CalculationResult;
}

export interface AnnualAssessment {
  zvE: number;
  incomeTax: number;
  soli: number;
  kirchensteuer: number;
  total: number;
  /** Lohnsteuer + Soli + KiSt already withheld by the employers */
  withheld: number;
  /** > 0: Nachzahlung, < 0: Erstattung */
  balance: number;
}

export interface ScenarioResult {
  jobs: JobResult[];
  /** Everything combined (annual tax when assessed jointly) */
  total: CalculationResult;
  /** Joint annual assessment (Steuererklärung) — only with several jobs / self-employment */
  annual: AnnualAssessment | null;
}

export interface LineItem {
  key: string;
  label: string;
  /** Monthly EUR */
  monthly: number;
  /** Yearly EUR */
  yearly: number;
  /** Effective rate applied, in % (for display), if meaningful */
  ratePct?: number;
  /** Optional note / assumption shown as tooltip */
  note?: string;
}

export interface CalculationResult {
  gross: { monthly: number; yearly: number };

  // ── Employee (Arbeitnehmer) ────────────────────────────────
  tax: {
    lohnsteuer: LineItem;
    soli: LineItem;
    kirchensteuer: LineItem;
    total: LineItem;
  };
  employeeSocial: {
    rente: LineItem;
    arbeitslosen: LineItem;
    kranken: LineItem;
    pflege: LineItem;
    total: LineItem;
  };
  /** Private health premium paid by employee (private models only) */
  privateHealthEmployee?: LineItem;

  net: { monthly: number; yearly: number };

  // ── Employer (Arbeitgeber) ─────────────────────────────────
  employerSocial: {
    rente: LineItem;
    arbeitslosen: LineItem;
    kranken: LineItem;
    pflege: LineItem;
    insolvenzgeld: LineItem;
    u1: LineItem;
    u2: LineItem;
    unfall: LineItem;
    /** Minijob flat tax (Pauschsteuer; 2 %, 2027 planned 5 %) — 0 for regular employment */
    pauschsteuer: LineItem;
    total: LineItem;
  };
  /** Total cost to the employer = gross + employer contributions */
  employerTotalCost: { monthly: number; yearly: number };

  meta: {
    /** tax year the result was computed for */
    year: number;
    /** zu versteuerndes Einkommen (annual), for transparency */
    zvE: number;
    vorsorgepauschale: number;
    /** true if any approximation was used (Steuerklasse V/VI) */
    approximate: boolean;
    /** true if the year's figures are still provisional (drafts, not final law) */
    provisional: boolean;
    /** true if the result relies on the (non-binding) Rentenkommission proposal */
    proposal: boolean;
    /** true for the self-employed calculation (no employer, profit instead of salary) */
    selfEmployed: boolean;
    notes: string[];
  };
}
