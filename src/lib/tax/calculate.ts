// Orchestrates the full Brutto → Netto calculation and the employer-cost view.

import { getConstants, STATES, type YearConstants } from "./constants";
import {
  lohnsteuerAnnual,
  soliAnnual,
  kirchensteuerAnnual,
  bemessungForSoliKist,
} from "./income-tax";
import { computeSocial, vorsorgepauschale } from "./social";
import { calculateSelfEmployed } from "./self-employed";
import type { CalculationResult, LineItem, JobInput, Steuerklasse } from "./types";

const mk = (
  key: string,
  label: string,
  yearly: number,
  opts?: { ratePct?: number; note?: string },
): LineItem => ({
  key,
  label,
  yearly,
  monthly: yearly / 12,
  ratePct: opts?.ratePct,
  note: opts?.note,
});

/** Child-allowance units (Kinderfreibetragszähler) used for Soli/KiSt assessment. */
export function childAllowanceUnits(klasse: Steuerklasse, children: number): number {
  if (children <= 0) return 0;
  switch (klasse) {
    case 4:
      return children * 0.5;
    case 5:
    case 6:
      return 0;
    default: // I, II, III — full attribution assumed
      return children * 1.0;
  }
}

/** Scale the contribution ceilings for a job that shares them with other jobs. */
function withBbgShare(C: YearConstants, share: number | undefined): YearConstants {
  if (share === undefined || share >= 1) return C;
  return { ...C, bbgRv: C.bbgRv * share, bbgKv: C.bbgKv * share };
}

/** Calculate a single job (or the only job) of a person. */
export function calculate(input: JobInput): CalculationResult {
  const C = withBbgShare(getConstants(input.year), input.bbgShare);
  const grossAnnual =
    input.grossPeriod === "monthly" ? input.grossAmount * 12 : input.grossAmount;
  const klasse = input.steuerklasse;

  if (input.selfEmployed) {
    return calculateSelfEmployed(
      input,
      grossAnnual,
      C,
      C.provisional ? [PROVISIONAL_NOTE(C.year)] : [],
    );
  }
  if (input.minijob) return calculateMinijob(input, grossAnnual, C);

  // ── Taxable income (zu versteuerndes Einkommen) ──
  const vsp = vorsorgepauschale(input, grossAnnual, klasse, C);
  const werbungskosten = klasse === 6 ? 0 : C.arbeitnehmerPauschbetrag;
  const entlastung =
    klasse === 2 && input.children >= 1
      ? C.entlastungAlleinerziehend +
        C.entlastungAlleinerziehendExtra * (input.children - 1)
      : 0;

  const zvE = Math.max(
    0,
    Math.floor(
      grossAnnual -
        werbungskosten -
        (klasse === 6 ? 0 : C.sonderausgabenPauschbetrag) -
        vsp -
        entlastung,
    ),
  );

  // ── Lohnsteuer, Soli, Kirchensteuer ──
  const lst = lohnsteuerAnnual(zvE, klasse, C);

  const units = childAllowanceUnits(klasse, input.children);
  const soliBase = units > 0 ? bemessungForSoliKist(zvE, klasse, units, C) : lst;
  const soli = soliAnnual(soliBase, klasse, C);

  const state = STATES.find((s) => s.id === input.bundesland);
  const kistRate = state?.kistRate ?? 9;
  const kist = input.church ? kirchensteuerAnnual(soliBase, kistRate) : 0;

  const taxTotal = lst + soli + kist;

  // ── Social contributions ──
  const social = computeSocial(input, grossAnnual, C);

  const employeeSocialTotal =
    social.rente.employee.yearly +
    social.arbeitslosen.employee.yearly +
    social.kranken.employee.yearly +
    social.pflege.employee.yearly;

  // Net = gross − taxes − employee social − net private premium (if private)
  const netAnnual =
    grossAnnual - taxTotal - employeeSocialTotal - social.privateEmployeeAnnual;

  // ── Employer side ──
  const baseRV = Math.min(grossAnnual, C.bbgRv);
  const insolvenzgeldYearly = input.employer.insolvenzgeld
    ? (baseRV * C.insolvenzgeld) / 100
    : 0;
  const u1Yearly = (grossAnnual * (input.employer.u1Pct || 0)) / 100;
  const u2Yearly = (grossAnnual * (input.employer.u2Pct || 0)) / 100;
  const unfallYearly = (grossAnnual * (input.employer.unfallPct || 0)) / 100;

  // For private models the employer pays a subsidy instead of statutory KV/PV.
  const isPrivate = input.health.kind !== "gkv";
  const employerKVYearly = isPrivate
    ? social.privateEmployerSubsidyAnnual
    : social.kranken.employer.yearly;
  const employerPVYearly = isPrivate ? 0 : social.pflege.employer.yearly;

  const employerSocialTotal =
    social.rente.employer.yearly +
    social.arbeitslosen.employer.yearly +
    employerKVYearly +
    employerPVYearly +
    insolvenzgeldYearly +
    u1Yearly +
    u2Yearly +
    unfallYearly;

  const employerTotalCostAnnual = grossAnnual + employerSocialTotal;

  // ── Assemble result ──
  const notes: string[] = C.provisional ? [PROVISIONAL_NOTE(C.year)] : [];
  const approximate = klasse === 5 || klasse === 6;
  if (approximate) {
    notes.push(
      "Steuerklasse V/VI: Lohnsteuer als enge Näherung (1,25/0,75-Verfahren §39b EStG).",
    );
  }
  if (input.midijob) {
    notes.push(
      "Übergangsbereich (Midijob): reduzierte Arbeitnehmerbeiträge, höherer Arbeitgeberanteil (§ 20a SGB IV).",
    );
  }
  if (isPrivate && !input.noHealth) {
    notes.push(
      input.health.kind === "pkv_zuschuss"
        ? "PKV: Arbeitgeberzuschuss auf den gesetzlichen Höchstzuschuss begrenzt."
        : "PKV ohne Arbeitgeberzuschuss — der Arbeitnehmer trägt die volle Prämie.",
    );
    notes.push(
      `PKV: steuerlich abzugsfähig ist nur die Basisabsicherung (hier ${input.health.basisPct} % der Prämie).`,
    );
  }

  return {
    gross: { monthly: grossAnnual / 12, yearly: grossAnnual },
    tax: {
      lohnsteuer: mk("lohnsteuer", "Lohnsteuer", lst),
      soli: mk("soli", "Solidaritätszuschlag", soli),
      kirchensteuer: mk("kist", "Kirchensteuer", kist, {
        ratePct: input.church ? kistRate : undefined,
      }),
      total: mk("tax-total", "Steuern gesamt", taxTotal),
    },
    employeeSocial: {
      rente: mk("rv-an", "Rentenversicherung", social.rente.employee.yearly, {
        ratePct: social.rente.employee.ratePct,
      }),
      arbeitslosen: mk(
        "alv-an",
        "Arbeitslosenversicherung",
        social.arbeitslosen.employee.yearly,
        { ratePct: social.arbeitslosen.employee.ratePct },
      ),
      kranken: mk("kv-an", "Krankenversicherung", social.kranken.employee.yearly, {
        ratePct: social.kranken.employee.ratePct,
      }),
      pflege: mk("pv-an", "Pflegeversicherung", social.pflege.employee.yearly, {
        ratePct: social.pflege.employee.ratePct,
      }),
      total: mk("soc-an-total", "Sozialabgaben gesamt", employeeSocialTotal),
    },
    privateHealthEmployee: isPrivate
      ? mk("pkv-an", "Private Krankenversicherung", social.privateEmployeeAnnual)
      : undefined,
    net: { monthly: netAnnual / 12, yearly: netAnnual },
    employerSocial: {
      rente: mk("rv-ag", "Rentenversicherung", social.rente.employer.yearly, {
        ratePct: social.rente.employer.ratePct,
      }),
      arbeitslosen: mk(
        "alv-ag",
        "Arbeitslosenversicherung",
        social.arbeitslosen.employer.yearly,
        { ratePct: social.arbeitslosen.employer.ratePct },
      ),
      kranken: mk(
        "kv-ag",
        isPrivate ? "Zuschuss PKV" : "Krankenversicherung",
        employerKVYearly,
        { ratePct: isPrivate ? undefined : social.kranken.employer.ratePct },
      ),
      pflege: mk("pv-ag", "Pflegeversicherung", employerPVYearly, {
        ratePct: isPrivate ? undefined : social.pflege.employer.ratePct,
      }),
      insolvenzgeld: mk("u3-ag", "Insolvenzgeldumlage (U3)", insolvenzgeldYearly, {
        ratePct: input.employer.insolvenzgeld ? C.insolvenzgeld : undefined,
      }),
      u1: mk("u1-ag", "Umlage U1 (Krankheit)", u1Yearly, {
        ratePct: input.employer.u1Pct || undefined,
      }),
      u2: mk("u2-ag", "Umlage U2 (Mutterschaft)", u2Yearly, {
        ratePct: input.employer.u2Pct || undefined,
      }),
      unfall: mk("unfall-ag", "Unfallversicherung (BG)", unfallYearly, {
        ratePct: input.employer.unfallPct || undefined,
      }),
      pauschsteuer: mk("pausch-ag", "Pauschsteuer", 0),
      total: mk("soc-ag-total", "Arbeitgeberanteil gesamt", employerSocialTotal),
    },
    employerTotalCost: {
      monthly: employerTotalCostAnnual / 12,
      yearly: employerTotalCostAnnual,
    },
    meta: {
      year: C.year,
      zvE,
      vorsorgepauschale: vsp,
      approximate,
      provisional: C.provisional,
      proposal: false,
      selfEmployed: false,
      notes,
    },
  };
}

const pct = (v: number) => `${String(v).replace(".", ",")}%`;

const PROVISIONAL_NOTE = (year: number) =>
  `Werte für ${year} sind vorläufig (Gesetz-/Verordnungsentwürfe, Stand November 2026) und können sich noch ändern.`;

/**
 * Minijob (geringfügige Beschäftigung): the employee pays no tax and no social
 * contributions except, by default, a 3.6% pension top-up (unless exempt). The
 * employer carries flat-rate contributions: 15% pension, a flat health rate
 * (only if the employee is in the GKV; 13%, from 2027 14.6% + Ø-Zusatzbeitrag)
 * and a Pauschsteuer (2%, from 2027 planned 5%), plus the usual levies.
 */
function calculateMinijob(
  input: JobInput,
  grossAnnual: number,
  C: YearConstants,
): CalculationResult {
  const isGkv = input.health.kind === "gkv";

  // A Minijob is capped at the Geringfügigkeitsgrenze. We cap only here in the
  // calculation — the stored input keeps the user's amount so toggling Minijob
  // off restores it. Earning less than the limit is allowed.
  const limitAnnual = C.minijobLimit * 12;
  const wasCapped = grossAnnual > limitAnnual + 0.005;
  const annual = Math.min(grossAnnual, limitAnnual);
  const grossMonthly = annual / 12;

  // Employee: optional 3.6% pension top-up (18.6% − 15% employer share).
  const rvTopRate = input.pensionInsured
    ? Math.round((C.rvRate - C.minijobRvPauschal) * 100) / 100
    : 0;
  const rvEmployeeYearly = (annual * rvTopRate) / 100;
  const employeeSocialTotal = rvEmployeeYearly;
  const netAnnual = annual - employeeSocialTotal;

  // Employer flat-rate contributions.
  const rvPauschalYearly = (annual * C.minijobRvPauschal) / 100;
  const kvPauschalYearly = isGkv ? (annual * C.minijobKvPauschal) / 100 : 0;
  const pauschsteuerYearly = (annual * C.minijobPauschsteuer) / 100;
  const insolvenzgeldYearly = input.employer.insolvenzgeld
    ? (annual * C.insolvenzgeld) / 100
    : 0;
  const u1Yearly = (annual * (input.employer.u1Pct || 0)) / 100;
  const u2Yearly = (annual * (input.employer.u2Pct || 0)) / 100;
  const unfallYearly = (annual * (input.employer.unfallPct || 0)) / 100;

  const employerSocialTotal =
    rvPauschalYearly +
    kvPauschalYearly +
    pauschsteuerYearly +
    insolvenzgeldYearly +
    u1Yearly +
    u2Yearly +
    unfallYearly;
  const employerTotalCostAnnual = annual + employerSocialTotal;

  const zero = (key: string, label: string) => mk(key, label, 0);

  const notes: string[] = [
    `Minijob: keine Lohnsteuer/Sozialabgaben für den Arbeitnehmer; pauschale Arbeitgeberbeiträge (${pct(C.minijobRvPauschal)} RV, ${pct(C.minijobKvPauschal)} KV bei GKV, ${pct(C.minijobPauschsteuer)} Pauschsteuer).`,
  ];
  if (rvTopRate > 0) {
    notes.push(`Rentenversicherung: ${pct(rvTopRate)} Arbeitnehmer-Eigenanteil (ohne Befreiung).`);
  } else {
    notes.push("Rentenversicherung: Befreiung angenommen (kein Eigenanteil).");
  }
  if (!isGkv) {
    notes.push(`PKV: kein pauschaler Krankenkassenbeitrag des Arbeitgebers (${pct(C.minijobKvPauschal)}).`);
  }
  if (C.provisional) notes.unshift(PROVISIONAL_NOTE(C.year));
  if (wasCapped) {
    notes.push(
      `Auf die Minijob-Grenze von ${C.minijobLimit} €/Monat begrenzt (${C.year}).`,
    );
  }

  return {
    gross: { monthly: grossMonthly, yearly: annual },
    tax: {
      lohnsteuer: zero("lohnsteuer", "Lohnsteuer"),
      soli: zero("soli", "Solidaritätszuschlag"),
      kirchensteuer: zero("kist", "Kirchensteuer"),
      total: zero("tax-total", "Steuern gesamt"),
    },
    employeeSocial: {
      rente: mk("rv-an", "Rentenversicherung (Eigenanteil)", rvEmployeeYearly, {
        ratePct: rvTopRate || undefined,
      }),
      arbeitslosen: zero("alv-an", "Arbeitslosenversicherung"),
      kranken: zero("kv-an", "Krankenversicherung"),
      pflege: zero("pv-an", "Pflegeversicherung"),
      total: mk("soc-an-total", "Sozialabgaben gesamt", employeeSocialTotal),
    },
    net: { monthly: netAnnual / 12, yearly: netAnnual },
    employerSocial: {
      rente: mk("rv-ag", "Pauschalbeitrag Rentenversicherung", rvPauschalYearly, {
        ratePct: C.minijobRvPauschal,
      }),
      arbeitslosen: zero("alv-ag", "Arbeitslosenversicherung"),
      kranken: mk("kv-ag", "Pauschalbeitrag Krankenversicherung", kvPauschalYearly, {
        ratePct: isGkv ? C.minijobKvPauschal : undefined,
      }),
      pflege: zero("pv-ag", "Pflegeversicherung"),
      insolvenzgeld: mk("u3-ag", "Insolvenzgeldumlage (U3)", insolvenzgeldYearly, {
        ratePct: input.employer.insolvenzgeld ? C.insolvenzgeld : undefined,
      }),
      u1: mk("u1-ag", "Umlage U1 (Krankheit)", u1Yearly, {
        ratePct: input.employer.u1Pct || undefined,
      }),
      u2: mk("u2-ag", "Umlage U2 (Mutterschaft)", u2Yearly, {
        ratePct: input.employer.u2Pct || undefined,
      }),
      unfall: mk("unfall-ag", "Unfallversicherung (BG)", unfallYearly, {
        ratePct: input.employer.unfallPct || undefined,
      }),
      pauschsteuer: mk("pausch-ag", "Pauschsteuer", pauschsteuerYearly, {
        ratePct: C.minijobPauschsteuer,
      }),
      total: mk("soc-ag-total", "Arbeitgeberanteil gesamt", employerSocialTotal),
    },
    employerTotalCost: {
      monthly: employerTotalCostAnnual / 12,
      yearly: employerTotalCostAnnual,
    },
    meta: {
      year: C.year,
      zvE: 0,
      vorsorgepauschale: 0,
      approximate: false,
      provisional: C.provisional,
      proposal: false,
      selfEmployed: false,
      notes,
    },
  };
}
