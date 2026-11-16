// Social-insurance contributions (Sozialversicherung): employee & employer
// shares, Pflegeversicherung specials, and the Vorsorgepauschale used to
// derive the taxable income for the Lohnsteuer. Year-parameterised.

import type { YearConstants } from "./constants";
import type { ScenarioInput, Steuerklasse } from "./types";

export interface RatePair {
  employee: number; // %
  employer: number; // %
}

const clampBase = (annual: number, ceiling: number) =>
  Math.min(Math.max(0, annual), ceiling);

/** Pflegeversicherung rates depend on Saxony, childlessness and child count. */
export function pflegeRates(input: ScenarioInput, C: YearConstants): RatePair {
  const isSaxony = input.bundesland === "SN";
  const childless = input.children === 0 && input.age >= 23;
  const base = C.pvRate / 2; // 1.8

  let employee = base;
  let employer = base;

  if (isSaxony) {
    employee += C.pvSachsenEmployeeExtra; // +0.5
    employer -= C.pvSachsenEmployeeExtra; // −0.5
  }

  if (childless) {
    employee += C.pvChildlessSurcharge; // employee only
  } else if (input.children >= 2) {
    const discount = Math.min(input.children - 1, 4) * C.pvChildDiscount;
    employee = Math.max(0, employee - discount);
  }

  return { employee, employer };
}

/** Krankenversicherung rates (statutory): half of 14.6% + half of the Zusatzbeitrag. */
export function krankenRates(zusatzPct: number, C: YearConstants): RatePair {
  const half = C.kvRate / 2 + zusatzPct / 2;
  return { employee: half, employer: half };
}

export interface SocialContribution {
  monthly: number;
  yearly: number;
  ratePct: number;
}

function contribution(annualBase: number, ratePct: number): SocialContribution {
  const yearly = (annualBase * ratePct) / 100;
  return { yearly, monthly: yearly / 12, ratePct };
}

export interface SocialResult {
  rente: { employee: SocialContribution; employer: SocialContribution };
  arbeitslosen: { employee: SocialContribution; employer: SocialContribution };
  kranken: { employee: SocialContribution; employer: SocialContribution };
  pflege: { employee: SocialContribution; employer: SocialContribution };
  privateEmployerSubsidyAnnual: number;
  privateEmployeeAnnual: number;
}

export function computeSocial(
  input: ScenarioInput,
  grossAnnual: number,
  C: YearConstants,
): SocialResult {
  const baseRV = clampBase(grossAnnual, C.bbgRv);
  const baseKV = clampBase(grossAnnual, C.bbgKv);

  const rvEmployee = C.rvRate / 2;
  const alvEmployee = C.alvRate / 2;

  // One combined flag gates both pension (RV) and unemployment (ALV) insurance.
  const rvRate = input.pensionInsured ? rvEmployee : 0;
  const alvRate = input.pensionInsured ? alvEmployee : 0;
  const rente = {
    employee: contribution(baseRV, rvRate),
    employer: contribution(baseRV, rvRate),
  };
  const arbeitslosen = {
    employee: contribution(baseRV, alvRate),
    employer: contribution(baseRV, alvRate),
  };

  const pfRates = pflegeRates(input, C);
  const isPrivate = input.health.kind !== "gkv";

  let kranken: SocialResult["kranken"];
  let pflege: SocialResult["pflege"];
  let privateEmployerSubsidyAnnual = 0;
  let privateEmployeeAnnual = 0;

  if (!isPrivate) {
    const kvRates = krankenRates(input.health.zusatzbeitragPct, C);
    kranken = {
      employee: contribution(baseKV, kvRates.employee),
      employer: contribution(baseKV, kvRates.employer),
    };
    pflege = {
      employee: contribution(baseKV, pfRates.employee),
      employer: contribution(baseKV, pfRates.employer),
    };
  } else {
    const zero: SocialContribution = { monthly: 0, yearly: 0, ratePct: 0 };
    kranken = { employee: zero, employer: zero };
    pflege = { employee: zero, employer: zero };

    const premiumAnnual = input.health.privateMonthlyPremium * 12;

    if (input.health.kind === "pkv_zuschuss") {
      // Höchstzuschuss: 50% of premium capped at the maximum statutory employer
      // share (KV general + half average Zusatzbeitrag, plus PV employer share).
      const kvCap = ((C.kvRate / 2 + C.defaultZusatz / 2) / 100) * C.bbgKv;
      const pvCap = (pfRates.employer / 100) * C.bbgKv;
      privateEmployerSubsidyAnnual = Math.min(premiumAnnual / 2, kvCap + pvCap);
    } else {
      // "pkv" — no employer subsidy; the employee bears the full premium.
      privateEmployerSubsidyAnnual = 0;
    }
    privateEmployeeAnnual = premiumAnnual - privateEmployerSubsidyAnnual;
  }

  return {
    rente,
    arbeitslosen,
    kranken,
    pflege,
    privateEmployerSubsidyAnnual,
    privateEmployeeAnnual,
  };
}

/**
 * Vorsorgepauschale (annual) — the lump-sum insurance deduction that lowers the
 * taxable income for the Lohnsteuer (§39b Abs. 2 Satz 5 Nr. 3 EStG).
 */
export function vorsorgepauschale(
  input: ScenarioInput,
  grossAnnual: number,
  klasse: Steuerklasse,
  C: YearConstants,
): number {
  const baseRV = clampBase(grossAnnual, C.bbgRv);
  const baseKV = clampBase(grossAnnual, C.bbgKv);

  // Teilbetrag Rentenversicherung — 100% deductible.
  const rvPart = input.pensionInsured ? (baseRV * (C.rvRate / 2)) / 100 : 0;

  // Teilbetrag Kranken-/Pflegeversicherung.
  let kvpvActual: number;
  if (input.health.kind === "gkv") {
    const kvRate = C.vorsorgeKvBase + input.health.zusatzbeitragPct / 2; // reduced base 7.0%
    const pvRate = pflegeRates(input, C).employee;
    kvpvActual = (baseKV * (kvRate + pvRate)) / 100;
  } else {
    // Only the Basisabsicherung portion of a PKV premium is deductible
    // (comfort tariffs / Krankengeld entitlement are excluded).
    kvpvActual =
      computeSocial(input, grossAnnual, C).privateEmployeeAnnual *
      (input.health.basisPct / 100);
  }

  const cap = klasse === 3 ? C.vorsorgeMindestCapIII : C.vorsorgeMindestCap;
  const mindest = Math.min((grossAnnual * C.vorsorgeMindestRate) / 100, cap);
  return rvPart + Math.max(kvpvActual, mindest);
}
