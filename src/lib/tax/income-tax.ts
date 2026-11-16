// Income tax (Lohnsteuer) per the German income-tax tariff §32a EStG,
// plus Solidaritätszuschlag and Kirchensteuer. Year-parameterised.
//
// Accuracy note: Steuerklassen I–IV follow the statutory tariff exactly
// (Grundtarif / Splittingtarif). Steuerklassen V and VI use the
// continuous 1.25/0.75 construction (§39b EStG) as a close approximation.

import type { YearConstants } from "./constants";
import type { Steuerklasse } from "./types";

/**
 * Annual income tax for a given taxable income (zu versteuerndes Einkommen),
 * following the §32a EStG piecewise formula for the given year.
 */
export function estTariff(zvE: number, C: YearConstants): number {
  const t = C.tariff;
  const x = Math.floor(Math.max(0, zvE));
  if (x <= t.gfb) return 0;

  if (x <= t.z2End) {
    const y = (x - t.gfb) / 10_000;
    return (t.z2A * y + t.z2B) * y;
  }
  if (x <= t.z3End) {
    const z = (x - t.z2End) / 10_000;
    return (t.z3A * z + t.z3B) * z + t.z3C;
  }
  if (x <= t.z4End) {
    return 0.42 * x - t.z4C;
  }
  if (t.z5End === undefined || t.z6C === undefined || x <= t.z5End) {
    return 0.45 * x - t.z5C;
  }
  return 0.47 * x - t.z6C;
}

/** Splitting tariff (Steuerklasse III): apply the tariff to half, then double. */
function splittingTariff(zvE: number, C: YearConstants): number {
  return 2 * estTariff(zvE / 2, C);
}

/**
 * Steuerklasse V / VI construction (§39b Abs. 2 Satz 7 EStG):
 * a continuous formula that removes most of the basic allowance.
 */
function tariffV(zvE: number, C: YearConstants): number {
  const x = Math.max(0, zvE);
  return (estTariff(x * 1.25, C) - estTariff(x * 0.75, C)) * 2;
}

/** Annual Lohnsteuer (before Soli/KiSt) for the given taxable income & class. */
export function lohnsteuerAnnual(
  zvE: number,
  klasse: Steuerklasse,
  C: YearConstants,
): number {
  let tax: number;
  switch (klasse) {
    case 3:
      tax = splittingTariff(zvE, C);
      break;
    case 5:
    case 6:
      tax = tariffV(zvE, C);
      break;
    default: // 1, 2, 4 → Grundtarif
      tax = estTariff(zvE, C);
  }
  return Math.floor(tax);
}

/**
 * Solidaritätszuschlag on an annual Lohnsteuer figure, with the Freigrenze and
 * the Milderungszone (gradual phase-in at 11.9% of the excess).
 */
export function soliAnnual(
  bemessung: number,
  klasse: Steuerklasse,
  C: YearConstants,
): number {
  const freigrenze = klasse === 3 ? C.soliFreigrenzeIII : C.soliFreigrenze;
  if (bemessung <= freigrenze) return 0;
  const full = (bemessung * C.soliRate) / 100;
  const milderung = (bemessung - freigrenze) * C.soliMilderung;
  return Math.min(full, milderung);
}

/** Kirchensteuer on an annual Lohnsteuer figure (after child allowances). */
export function kirchensteuerAnnual(bemessung: number, ratePct: number): number {
  return (bemessung * ratePct) / 100;
}

/**
 * Lohnsteuer used as the *base* for Soli & Kirchensteuer: child allowances are
 * deducted from the taxable income first.
 */
export function bemessungForSoliKist(
  zvE: number,
  klasse: Steuerklasse,
  childAllowanceUnits: number,
  C: YearConstants,
): number {
  const reduced = zvE - childAllowanceUnits * C.kinderfreibetragFull;
  return lohnsteuerAnnual(reduced, klasse, C);
}
