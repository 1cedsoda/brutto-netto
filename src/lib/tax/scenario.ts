// Multi-job scenarios: a person with one or more jobs (Hauptbeschäftigung,
// Nebenjobs, Minijobs, Selbstständigkeit).
//
// Rules (current law, simplified):
//  • Lohnsteuer: the main employment uses the personal Steuerklasse, every
//    further employment Steuerklasse VI. Minijobs are taxed flat by the employer.
//  • Social insurance: contributions of all employments subject to SV are
//    combined; the BBG applies to the sum and is split pro rata (§22 SGB IV).
//  • Minijobs: next to a main employment the first Minijob stays geringfügig;
//    every further Minijob is added to the main job (SV-pflichtig, ALV-frei).
//    Without a main employment Minijobs are added up; above the limit they all
//    become regular employments.
//  • Übergangsbereich (Midijob) applies to the combined wage of the employments.
//  • Self-employment: KV/PV via the employment if there is one, otherwise
//    voluntary GKV on the total income. Pension per Rentenkommission proposal
//    only if switched on.
//  • With several taxable incomes the income tax is assessed jointly
//    (Steuererklärung) and compared with the withheld Lohnsteuer.

import { calculate, childAllowanceUnits } from "./calculate";
import { getConstants, type YearConstants } from "./constants";
import {
  bemessungForSoliKist,
  kirchensteuerAnnual,
  lohnsteuerAnnual,
  soliAnnual,
} from "./income-tax";
import { STATES } from "./constants";
import type {
  AnnualAssessment,
  CalculationResult,
  Job,
  JobInput,
  JobResult,
  JobTreatment,
  LineItem,
  ScenarioInput,
  ScenarioResult,
  Steuerklasse,
} from "./types";

const annualOf = (s: ScenarioInput, job: Job) =>
  Math.max(0, s.grossPeriod === "monthly" ? job.grossAmount * 12 : job.grossAmount);

/** Build the single-job input for the legacy per-job calculation. */
function jobInput(s: ScenarioInput, job: Job, patch: Partial<JobInput> = {}): JobInput {
  return {
    year: s.year,
    grossPeriod: "yearly",
    grossAmount: annualOf(s, job),
    steuerklasse: s.steuerklasse,
    bundesland: s.bundesland,
    church: s.church,
    children: s.children,
    age: s.age,
    pensionInsured: s.pensionInsured,
    minijob: job.kind === "minijob",
    selfEmployed: job.kind === "self",
    rvCommission: s.rvCommission,
    rvProposal: s.rvProposal,
    health: s.health,
    employer: job.employer,
    ...patch,
  };
}

/** Classify every job according to the multi-job rules. */
export function classifyJobs(
  s: ScenarioInput,
  C: YearConstants = getConstants(s.year),
): JobTreatment[] {
  const jobs = s.jobs;
  const out: JobTreatment[] = jobs.map((j) => (j.kind === "self" ? "self" : "side"));

  const employees = jobs.map((j, i) => (j.kind === "employee" ? i : -1)).filter((i) => i >= 0);
  const minijobs = jobs.map((j, i) => (j.kind === "minijob" ? i : -1)).filter((i) => i >= 0);

  if (employees.length > 0) {
    employees.forEach((i, n) => (out[i] = n === 0 ? "main" : "side"));
    minijobs.forEach((i, n) => (out[i] = n === 0 ? "minijob" : "minijob-combined"));
  } else if (minijobs.length > 0) {
    const sumMonthly = minijobs.reduce((acc, i) => acc + annualOf(s, jobs[i]) / 12, 0);
    if (sumMonthly <= C.minijobLimit + 0.005) {
      minijobs.forEach((i) => (out[i] = "minijob"));
    } else {
      // Above the limit all Minijobs become regular employments.
      minijobs.forEach((i, n) => (out[i] = n === 0 ? "main" : "side"));
    }
  }

  // Übergangsbereich: combined wage of all SV-pflichtige employments.
  const svIdx = out
    .map((t, i) => (t === "main" || t === "side" || t === "minijob-combined" ? i : -1))
    .filter((i) => i >= 0);
  const svMonthly = svIdx.reduce((acc, i) => acc + annualOf(s, jobs[i]) / 12, 0);
  if (svMonthly > C.minijobLimit && svMonthly <= C.midijobUpper) {
    svIdx.forEach((i) => out[i] === "main" && (out[i] = "midijob"));
  }
  return out;
}

/** Factors of the Übergangsbereich formula (§20a SGB IV) for a monthly wage. */
function midijobFactors(aeMonthly: number, C: YearConstants) {
  const G = C.minijobLimit;
  const OG = C.midijobUpper;
  const F = C.faktorF;
  const be = F * G + (OG / (OG - G) - (G / (OG - G)) * F) * (aeMonthly - G);
  const beAn = (OG / (OG - G)) * (aeMonthly - G);
  return { totalFactor: be / aeMonthly, employeeFactor: beAn / aeMonthly };
}

const mk = (key: string, label: string, yearly: number, ratePct?: number): LineItem => ({
  key,
  label,
  yearly,
  monthly: yearly / 12,
  ratePct,
});

/** Sum line items of several results (rate only kept if identical everywhere). */
function sumItems(items: LineItem[], key: string, label: string): LineItem {
  const yearly = items.reduce((a, i) => a + i.yearly, 0);
  const rates = items.filter((i) => i.yearly !== 0).map((i) => i.ratePct);
  const same = rates.length > 0 && rates.every((r) => r === rates[0]);
  return mk(key, label, yearly, same ? rates[0] : undefined);
}

export function calculateScenario(s: ScenarioInput): ScenarioResult {
  const C = getConstants(s.year);
  const jobs = s.jobs.length ? s.jobs : [];
  const treatments = classifyJobs(s, C);

  const isSv = (t: JobTreatment) =>
    t === "main" || t === "side" || t === "midijob" || t === "minijob-combined";
  const svIdx = treatments.map((t, i) => (isSv(t) ? i : -1)).filter((i) => i >= 0);
  const svAnnual = svIdx.reduce((a, i) => a + annualOf(s, jobs[i]), 0);
  const midi =
    svIdx.length > 0 && treatments.includes("midijob")
      ? midijobFactors(svAnnual / 12, C)
      : undefined;
  const hasSvEmployment = svIdx.length > 0;
  const minijobAnnual = treatments.reduce(
    (a, t, i) => (t === "minijob" ? a + annualOf(s, jobs[i]) : a),
    0,
  );

  const selfIdx = treatments.indexOf("self");
  const taxable = treatments.filter((t) => isSv(t) || t === "self").length;
  // Joint assessment when there is more than one taxable income, or
  // self-employment next to anything else.
  const joint = taxable > 1 || (selfIdx >= 0 && jobs.length > 1);

  // The first SV-pflichtige employment carries the health insurance (PKV premium).
  const healthCarrier = svIdx[0] ?? -1;

  const results: JobResult[] = jobs.map((job, index) => {
    const t = treatments[index];
    let input: JobInput;
    let klasse: Steuerklasse | null = null;
    switch (t) {
      case "main":
      case "midijob":
      case "side":
      case "minijob-combined": {
        klasse = t === "main" || t === "midijob" ? s.steuerklasse : 6;
        const share = svAnnual > 0 ? annualOf(s, job) / svAnnual : 1;
        const privateHealth = s.health.kind !== "gkv";
        input = jobInput(s, job, {
          minijob: false,
          selfEmployed: false,
          steuerklasse: klasse,
          bbgShare: svIdx.length > 1 ? share : undefined,
          alvExempt: t === "minijob-combined",
          midijob: midi,
          // PKV: premium & subsidy handled once, by the main employment.
          noHealth: privateHealth && index !== healthCarrier,
        });
        break;
      }
      case "minijob":
        input = jobInput(s, job, { minijob: true, selfEmployed: false });
        break;
      case "self":
        input = jobInput(s, job, {
          minijob: false,
          selfEmployed: true,
          noHealth: hasSvEmployment,
          kvExtraIncome: hasSvEmployment ? 0 : minijobAnnual,
          selfWithTax: !joint,
        });
        break;
    }
    return { job, index, treatment: t, steuerklasse: klasse, result: calculate(input) };
  });

  const annual = joint ? assess(s, results, C) : null;
  const total =
    results.length === 1 && !annual ? results[0].result : aggregate(s, results, annual, C);
  return { jobs: results, total, annual };
}

/** Joint annual income-tax assessment (Steuererklärung). */
function assess(s: ScenarioInput, jobs: JobResult[], C: YearConstants): AnnualAssessment {
  let wages = 0;
  let selfIncome = 0;
  let vorsorge = 0;
  let withheld = 0;
  for (const { treatment: t, result: r } of jobs) {
    if (t === "minijob") {
      // flat-taxed by the employer; only the employee's pension top-up counts
      vorsorge += r.employeeSocial.rente.yearly;
      continue;
    }
    if (t === "self") {
      selfIncome += r.gross.yearly;
      vorsorge += r.meta.vorsorgepauschale; // actual deductible contributions
      continue;
    }
    wages += r.gross.yearly;
    withheld += r.tax.total.yearly;
    const e = r.employeeSocial;
    vorsorge += e.rente.yearly + e.kranken.yearly * 0.96 + e.pflege.yearly;
    if (r.privateHealthEmployee) vorsorge += r.privateHealthEmployee.yearly * (s.health.basisPct / 100);
  }
  const werbungskosten = Math.min(wages, wages > 0 ? C.arbeitnehmerPauschbetrag : 0);
  const entlastung =
    s.steuerklasse === 2 && s.children >= 1
      ? C.entlastungAlleinerziehend + C.entlastungAlleinerziehendExtra * (s.children - 1)
      : 0;
  const zvE = Math.max(
    0,
    Math.floor(wages - werbungskosten + selfIncome - C.sonderausgabenPauschbetrag - vorsorge - entlastung),
  );
  const klasse: Steuerklasse = s.steuerklasse === 3 ? 3 : 1;
  const incomeTax = lohnsteuerAnnual(zvE, klasse, C);
  const units = childAllowanceUnits(klasse, s.children);
  const base = units > 0 ? bemessungForSoliKist(zvE, klasse, units, C) : incomeTax;
  const soli = soliAnnual(base, klasse, C);
  const kistRate = STATES.find((x) => x.id === s.bundesland)?.kistRate ?? 9;
  const kirchensteuer = s.church ? kirchensteuerAnnual(base, kistRate) : 0;
  const total = incomeTax + soli + kirchensteuer;
  return { zvE, incomeTax, soli, kirchensteuer, total, withheld, balance: total - withheld };
}

/** Combine all job results into one, using the annual assessment for taxes. */
function aggregate(
  s: ScenarioInput,
  jobs: JobResult[],
  annual: AnnualAssessment | null,
  C: YearConstants,
): CalculationResult {
  const rs = jobs.map((j) => j.result);
  const sum = (f: (r: CalculationResult) => number) => rs.reduce((a, r) => a + f(r), 0);
  const items = (f: (r: CalculationResult) => LineItem, key: string, label: string) =>
    sumItems(rs.map(f), key, label);

  const grossY = sum((r) => r.gross.yearly);
  const tax = annual
    ? {
        lohnsteuer: mk("lohnsteuer", "Einkommensteuer", annual.incomeTax),
        soli: mk("soli", "Solidaritätszuschlag", annual.soli),
        kirchensteuer: mk("kist", "Kirchensteuer", annual.kirchensteuer),
        total: mk("tax-total", "Steuern gesamt", annual.total),
      }
    : {
        lohnsteuer: items((r) => r.tax.lohnsteuer, "lohnsteuer", "Lohnsteuer"),
        soli: items((r) => r.tax.soli, "soli", "Solidaritätszuschlag"),
        kirchensteuer: items((r) => r.tax.kirchensteuer, "kist", "Kirchensteuer"),
        total: items((r) => r.tax.total, "tax-total", "Steuern gesamt"),
      };
  const anyProposal = rs.some((r) => r.meta.proposal);
  const employeeSocial = {
    rente: items(
      (r) => r.employeeSocial.rente,
      "rv-an",
      anyProposal ? "Rentenversicherung (inkl. Vorschlag Rentenkommission)" : "Rentenversicherung",
    ),
    arbeitslosen: items((r) => r.employeeSocial.arbeitslosen, "alv-an", "Arbeitslosenversicherung"),
    kranken: items((r) => r.employeeSocial.kranken, "kv-an", "Krankenversicherung"),
    pflege: items((r) => r.employeeSocial.pflege, "pv-an", "Pflegeversicherung"),
    total: items((r) => r.employeeSocial.total, "soc-an-total", "Sozialabgaben gesamt"),
  };
  const pkv = rs.filter((r) => r.privateHealthEmployee).map((r) => r.privateHealthEmployee!);
  const privateHealthEmployee = pkv.length
    ? sumItems(pkv, "pkv-an", "Private Krankenversicherung")
    : undefined;
  const a = (f: (r: CalculationResult) => LineItem, key: string, label: string) =>
    items(f, key, label);
  const employerSocial = {
    rente: a((r) => r.employerSocial.rente, "rv-ag", "Rentenversicherung"),
    arbeitslosen: a((r) => r.employerSocial.arbeitslosen, "alv-ag", "Arbeitslosenversicherung"),
    kranken: a((r) => r.employerSocial.kranken, "kv-ag", "Krankenversicherung"),
    pflege: a((r) => r.employerSocial.pflege, "pv-ag", "Pflegeversicherung"),
    insolvenzgeld: a((r) => r.employerSocial.insolvenzgeld, "u3-ag", "Insolvenzgeldumlage (U3)"),
    u1: a((r) => r.employerSocial.u1, "u1-ag", "Umlage U1 (Krankheit)"),
    u2: a((r) => r.employerSocial.u2, "u2-ag", "Umlage U2 (Mutterschaft)"),
    unfall: a((r) => r.employerSocial.unfall, "unfall-ag", "Unfallversicherung (BG)"),
    pauschsteuer: a((r) => r.employerSocial.pauschsteuer, "pausch-ag", "Pauschsteuer"),
    total: a((r) => r.employerSocial.total, "soc-ag-total", "Arbeitgeberanteil gesamt"),
  };
  const netY =
    grossY - tax.total.yearly - employeeSocial.total.yearly - (privateHealthEmployee?.yearly ?? 0);
  const costY = sum((r) => r.employerTotalCost.yearly);

  const notes: string[] = [];
  if (annual) {
    notes.push(
      `Mehrere Einkünfte: Einkommensteuer per Steuererklärung (Jahr). Einbehaltene Lohnsteuer ${fmt(annual.withheld)} €, ` +
        (annual.balance >= 0
          ? `voraussichtliche Nachzahlung ${fmt(annual.balance)} €.`
          : `voraussichtliche Erstattung ${fmt(-annual.balance)} €.`),
    );
    if (s.steuerklasse === 4 || s.steuerklasse === 5) {
      notes.push("Steuerklasse IV/V: Jahressteuer ohne Partnereinkommen als Einzelveranlagung genähert.");
    }
  }
  for (const r of rs)
    for (const n of r.meta.notes)
      if (!notes.includes(n) && !(annual && n.startsWith("Steuerklasse V/VI"))) notes.push(n);

  return {
    gross: { monthly: grossY / 12, yearly: grossY },
    tax,
    employeeSocial,
    privateHealthEmployee,
    net: { monthly: netY / 12, yearly: netY },
    employerSocial,
    employerTotalCost: { monthly: costY / 12, yearly: costY },
    meta: {
      year: C.year,
      zvE: annual ? annual.zvE : (rs[0]?.meta.zvE ?? 0),
      vorsorgepauschale: sum((r) => r.meta.vorsorgepauschale),
      // StKl V/VI only approximates the withholding; the annual tax is exact.
      approximate: annual ? false : rs.some((r) => r.meta.approximate),
      provisional: C.provisional,
      proposal: anyProposal,
      selfEmployed: jobs.length > 0 && jobs.every((j) => j.treatment === "self"),
      notes,
    },
  };
}

const fmt = (v: number) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
