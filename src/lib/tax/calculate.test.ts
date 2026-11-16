import { describe, it, expect } from "bun:test";
import { calculate } from "./calculate";
import type { HealthInsurance, ScenarioInput } from "./types";

// ── Base case ─────────────────────────────────────────────────────────────
// 5.000 €/Monat, Steuerklasse I, NRW, kinderlos (30 J.), GKV mit 2,5 %
// Zusatzbeitrag, gesetzlich rentenversichert, Steuerjahr 2025.
const BASE: ScenarioInput = {
  year: 2025,
  grossPeriod: "monthly",
  grossAmount: 5000,
  steuerklasse: 1,
  bundesland: "NW",
  church: false,
  children: 0,
  age: 30,
  pensionInsured: true,
  minijob: false,
  selfEmployed: false,
  rvProposal: "gruender",
  health: {
    kind: "gkv",
    zusatzbeitragPct: 2.5,
    fundId: "average",
    privateMonthlyPremium: 700,
    basisPct: 85,
  },
  employer: { insolvenzgeld: true, u1Pct: 0, u2Pct: 0, unfallPct: 0 },
};

/** Calculate the base case with a shallow patch. */
const calc = (patch: Partial<ScenarioInput> = {}) => calculate({ ...BASE, ...patch });
/** Patch only the health sub-object. */
const calcH = (patch: Partial<HealthInsurance>) =>
  calculate({ ...BASE, health: { ...BASE.health, ...patch } });

const base = calculate(BASE);

describe("base case (5.000 € StKl I, NRW, GKV 2,5 %, 2025)", () => {
  it("gross is annualised correctly", () => {
    expect(base.gross.monthly).toBe(5000);
    expect(base.gross.yearly).toBe(60000);
  });

  it("Lohnsteuer matches the §32a 2025 tariff", () => {
    expect(base.tax.lohnsteuer.monthly).toBeCloseTo(796.75, 2);
  });

  it("no Soli / Kirchensteuer", () => {
    expect(base.tax.soli.monthly).toBe(0);
    expect(base.tax.kirchensteuer.monthly).toBe(0);
  });

  it("employee social contributions", () => {
    expect(base.employeeSocial.rente.monthly).toBeCloseTo(465, 2); // 9,3 %
    expect(base.employeeSocial.arbeitslosen.monthly).toBeCloseTo(65, 2); // 1,3 %
    expect(base.employeeSocial.kranken.monthly).toBeCloseTo(427.5, 2); // 8,55 %
    expect(base.employeeSocial.pflege.monthly).toBeCloseTo(120, 2); // 2,4 % (kinderlos)
  });

  it("net take-home", () => {
    expect(base.net.monthly).toBeCloseTo(3125.75, 2);
  });

  it("invariant: net = gross − taxes − employee social", () => {
    expect(base.net.monthly).toBeCloseTo(
      base.gross.monthly - base.tax.total.monthly - base.employeeSocial.total.monthly,
      6,
    );
  });

  it("invariant: employer cost = gross + employer share", () => {
    expect(base.employerTotalCost.monthly).toBeCloseTo(
      base.gross.monthly + base.employerSocial.total.monthly,
      6,
    );
  });

  it("invariant: employer cost splits exactly into all destinations", () => {
    const sum =
      base.net.monthly +
      base.tax.total.monthly +
      base.employeeSocial.total.monthly +
      base.employerSocial.total.monthly;
    expect(sum).toBeCloseTo(base.employerTotalCost.monthly, 6);
  });
});

describe("one change vs. base", () => {
  it("church → adds Kirchensteuer and lowers net by exactly that", () => {
    const r = calc({ church: true });
    expect(r.tax.kirchensteuer.monthly).toBeGreaterThan(70);
    expect(r.net.monthly).toBeCloseTo(base.net.monthly - r.tax.kirchensteuer.monthly, 6);
  });

  it("Steuerklasse III → much less Lohnsteuer, higher net", () => {
    const r = calc({ steuerklasse: 3 });
    expect(r.tax.lohnsteuer.monthly).toBeLessThan(base.tax.lohnsteuer.monthly);
    expect(r.net.monthly).toBeGreaterThan(base.net.monthly);
  });

  it("Steuerklasse V → more Lohnsteuer, lower net", () => {
    const r = calc({ steuerklasse: 5 });
    expect(r.tax.lohnsteuer.monthly).toBeGreaterThan(base.tax.lohnsteuer.monthly);
    expect(r.net.monthly).toBeLessThan(base.net.monthly);
  });

  it("2 children → Pflege discount (1,55 %), no childless surcharge", () => {
    const r = calc({ children: 2 });
    expect(r.employeeSocial.pflege.ratePct).toBeCloseTo(1.55, 2);
    expect(r.net.monthly).toBeGreaterThan(base.net.monthly);
  });

  it("age below 23 → no childless Pflege surcharge (1,8 %)", () => {
    const r = calc({ age: 20 });
    expect(r.employeeSocial.pflege.ratePct).toBeCloseTo(1.8, 2);
  });

  it("Sachsen → employee Pflege +0,5, employer −0,5", () => {
    const r = calc({ bundesland: "SN" });
    expect(r.employeeSocial.pflege.ratePct).toBeCloseTo(2.9, 2); // 1,8 +0,5 +0,6
    expect(r.employerSocial.pflege.ratePct).toBeCloseTo(1.3, 2);
  });

  it("year 2026 → higher Grundfreibetrag lowers tax, raises net", () => {
    const r = calc({ year: 2026 });
    expect(r.tax.lohnsteuer.monthly).toBeLessThan(base.tax.lohnsteuer.monthly);
    expect(r.net.monthly).toBeGreaterThan(base.net.monthly);
    expect(r.meta.year).toBe(2026);
  });

  it("no pension insurance → no RV and no ALV contribution (combined)", () => {
    const r = calc({ pensionInsured: false });
    expect(r.employeeSocial.rente.monthly).toBe(0);
    expect(r.employeeSocial.arbeitslosen.monthly).toBe(0);
    expect(r.net.monthly).toBeGreaterThan(base.net.monthly);
  });

  it("gross above the ceilings → KV capped at the BBG", () => {
    const r = calc({ grossAmount: 9000 });
    // 8,55 % of the monthly KV ceiling (66.150 / 12 = 5.512,50) = 471,32
    expect(r.employeeSocial.kranken.monthly).toBeCloseTo(471.32, 2);
  });

  it("yearly input of 60.000 equals the monthly base", () => {
    const r = calc({ grossPeriod: "yearly", grossAmount: 60000 });
    expect(r.net.yearly).toBeCloseTo(base.net.yearly, 4);
  });

  it("employer accident insurance → raises employer cost, net unchanged", () => {
    const r = calc({ employer: { ...BASE.employer, unfallPct: 1.3 } });
    expect(r.employerTotalCost.monthly).toBeGreaterThan(base.employerTotalCost.monthly);
    expect(r.net.monthly).toBeCloseTo(base.net.monthly, 6);
  });
});

describe("PKV with and without AG-Zuschuss (700 €/Monat Prämie)", () => {
  const withSubsidy = calcH({ kind: "pkv_zuschuss", privateMonthlyPremium: 700 });
  const without = calcH({ kind: "pkv", privateMonthlyPremium: 700 });

  it("both drop the statutory KV/PV employee contributions", () => {
    expect(withSubsidy.employeeSocial.kranken.monthly).toBe(0);
    expect(withSubsidy.employeeSocial.pflege.monthly).toBe(0);
    expect(without.employeeSocial.kranken.monthly).toBe(0);
    expect(without.employeeSocial.pflege.monthly).toBe(0);
  });

  it("with AG-Zuschuss: employer pays 50 % (below the cap), employee the rest", () => {
    expect(withSubsidy.employerSocial.kranken.monthly).toBeCloseTo(350, 2);
    expect(withSubsidy.privateHealthEmployee?.monthly).toBeCloseTo(350, 2);
  });

  it("without AG-Zuschuss: employer pays nothing, employee the full premium", () => {
    expect(without.employerSocial.kranken.monthly).toBe(0);
    expect(without.privateHealthEmployee?.monthly).toBeCloseTo(700, 2);
  });

  it("AG-Zuschuss → higher net for the employee", () => {
    expect(withSubsidy.net.monthly).toBeGreaterThan(without.net.monthly);
  });

  it("AG-Zuschuss → higher total employer cost", () => {
    expect(withSubsidy.employerTotalCost.monthly).toBeGreaterThan(
      without.employerTotalCost.monthly,
    );
  });

  it("the subsidy is capped at the statutory Höchstzuschuss for a high premium", () => {
    // 2.000 €/Monat premium → 50 % = 1.000, but the cap is far lower.
    const r = calcH({ kind: "pkv_zuschuss", privateMonthlyPremium: 2000 });
    expect(r.employerSocial.kranken.monthly).toBeLessThan(1000);
    expect(r.employerSocial.kranken.monthly).toBeCloseTo(570.54, 1);
  });

  it("Basistarif-Anteil: a lower deductible share → more tax, less net", () => {
    const full = calcH({ kind: "pkv", privateMonthlyPremium: 700, basisPct: 100 });
    const half = calcH({ kind: "pkv", privateMonthlyPremium: 700, basisPct: 50 });
    expect(half.tax.lohnsteuer.monthly).toBeGreaterThan(full.tax.lohnsteuer.monthly);
    expect(half.net.monthly).toBeLessThan(full.net.monthly);
  });
});

describe("GKV Zusatzbeitrag vs. base", () => {
  it("higher Zusatzbeitrag → higher KV contribution, lower net", () => {
    const r = calcH({ zusatzbeitragPct: 3.5 });
    expect(r.employeeSocial.kranken.monthly).toBeGreaterThan(
      base.employeeSocial.kranken.monthly,
    );
    expect(r.net.monthly).toBeLessThan(base.net.monthly);
  });
});

// ── Minijob base case ───────────────────────────────────────────────────────
// 556 €/Monat (Grenze 2025), GKV, rentenversicherungspflichtig.
const MINI: ScenarioInput = { ...BASE, minijob: true, grossAmount: 556 };
const mini = calculate(MINI);
const calcM = (patch: Partial<ScenarioInput> = {}) => calculate({ ...MINI, ...patch });

describe("Minijob base case (556 € GKV, RV-pflichtig, 2025)", () => {
  it("no employee tax", () => {
    expect(mini.tax.total.monthly).toBe(0);
  });

  it("only the 3,6 % pension top-up is deducted", () => {
    expect(mini.employeeSocial.rente.monthly).toBeCloseTo(20.02, 2);
    expect(mini.employeeSocial.kranken.monthly).toBe(0);
    expect(mini.employeeSocial.arbeitslosen.monthly).toBe(0);
    expect(mini.net.monthly).toBeCloseTo(556 - 20.016, 2);
  });

  it("employer flat-rate contributions (15 % RV, 13 % KV, 2 % Pauschsteuer)", () => {
    expect(mini.employerSocial.rente.monthly).toBeCloseTo(83.4, 2);
    expect(mini.employerSocial.kranken.monthly).toBeCloseTo(72.28, 2);
    expect(mini.employerSocial.pauschsteuer.monthly).toBeCloseTo(11.12, 2);
  });

  it("invariant: employer cost = gross + employer share", () => {
    expect(mini.employerTotalCost.monthly).toBeCloseTo(
      mini.gross.monthly + mini.employerSocial.total.monthly,
      6,
    );
  });
});

describe("Minijob — one change vs. mini base", () => {
  it("RV exemption → full gross as net", () => {
    const r = calcM({ pensionInsured: false });
    expect(r.employeeSocial.rente.monthly).toBe(0);
    expect(r.net.monthly).toBeCloseTo(556, 2);
  });

  it("PKV → no 13 % employer health flat rate", () => {
    const r = calcM({ health: { ...MINI.health, kind: "pkv" } });
    expect(r.employerSocial.kranken.monthly).toBe(0);
  });

  it("above the ceiling → income is capped in the calculation, with a note", () => {
    const r = calcM({ grossAmount: 700 });
    expect(r.gross.monthly).toBe(556); // capped, not 700
    expect(r.net.monthly).toBeCloseTo(mini.net.monthly, 2); // same as the 556 base
    expect(r.meta.notes.some((n) => n.includes("begrenzt"))).toBe(true);
  });

  it("below the ceiling is allowed (no cap, no note)", () => {
    const r = calcM({ grossAmount: 400 });
    expect(r.gross.monthly).toBe(400);
    expect(r.meta.notes.some((n) => n.includes("begrenzt"))).toBe(false);
  });

  it("2026 ceiling is 603 €", () => {
    const ok = calcM({ year: 2026, grossAmount: 603 });
    expect(ok.gross.monthly).toBe(603);
    const over = calcM({ year: 2026, grossAmount: 650 });
    expect(over.gross.monthly).toBe(603); // capped to the 2026 limit
  });
});

// ── 2027 & default year ──────────────────────────────────────────────────
import { currentTaxYear, getConstants } from "./constants";
import { estTariff } from "./income-tax";

describe("tax year 2027 (provisional)", () => {
  const C27 = getConstants(2027);

  it("is flagged provisional", () => {
    expect(C27.provisional).toBe(true);
    expect(calc({ year: 2027 }).meta.provisional).toBe(true);
    expect(base.meta.provisional).toBe(false);
  });

  it("§32a-E tariff 2027 incl. 47 % zone (Regierungsentwurf)", () => {
    expect(estTariff(12_564, C27)).toBe(0);
    expect(Math.round(estTariff(45_000, C27))).toBe(8_777);
    // 45 % zone (250.000–279.999) and new 47 % zone from 280.000
    expect(estTariff(260_000, C27)).toBeCloseTo(0.45 * 260_000 - 18_741.7, 2);
    expect(estTariff(300_000, C27)).toBeCloseTo(0.47 * 300_000 - 24_341.68, 2);
    // continuity at the zone boundaries (± a few euros)
    expect(Math.abs(estTariff(249_999, C27) - estTariff(250_000, C27))).toBeLessThan(5);
    expect(Math.abs(estTariff(279_999, C27) - estTariff(280_000, C27))).toBeLessThan(5);
  });

  it("2027 SV parameters: BBG, childless surcharge, Minijob limit", () => {
    const r = calc({ year: 2027, grossAmount: 10_000 });
    expect(r.employeeSocial.rente.monthly).toBeCloseTo(8_850 * 0.093, 2);
    expect(r.employeeSocial.kranken.monthly).toBeCloseTo(6_375 * 0.0855, 2);
    expect(r.employeeSocial.pflege.ratePct).toBeCloseTo(1.8 + 0.9, 5);
    const m = calc({ year: 2027, minijob: true, grossAmount: 700 });
    expect(m.gross.monthly).toBe(633);
    expect(m.employerSocial.pauschsteuer.ratePct).toBe(5);
  });
});

describe("currentTaxYear", () => {
  it("uses the calendar year when supported", () => {
    expect(currentTaxYear(new Date("2026-11-16"))).toBe(2026);
    expect(currentTaxYear(new Date("2027-03-01"))).toBe(2027);
  });
  it("clamps to the supported range", () => {
    expect(currentTaxYear(new Date("2024-06-01"))).toBe(2025);
    expect(currentTaxYear(new Date("2031-06-01"))).toBe(2027);
  });
});

// ── Selbstständige: Vorschlag Rentenkommission ──────────────────────────
describe("self-employed (Rentenkommission proposal, not law)", () => {
  const se = (patch: Partial<ScenarioInput> = {}) =>
    calc({ selfEmployed: true, year: 2026, grossAmount: 4_000, ...patch });

  it("is flagged as proposal, no employer side", () => {
    const r = se();
    expect(r.meta.proposal).toBe(true);
    expect(r.meta.selfEmployed).toBe(true);
    expect(r.employerSocial.total.yearly).toBe(0);
    expect(r.employeeSocial.arbeitslosen.yearly).toBe(0);
    expect(base.meta.proposal).toBe(false);
  });

  it("Regelbeitrag 2026 = 735,63 €, half for founders", () => {
    expect(se({ rvProposal: "regel" }).employeeSocial.rente.monthly).toBeCloseTo(735.63, 2);
    expect(se({ rvProposal: "gruender" }).employeeSocial.rente.monthly).toBeCloseTo(367.82, 2);
  });

  it("Regelbeitrag 2027 ≈ 768 € (Bezugsgröße 4.130 €)", () => {
    expect(se({ year: 2027, rvProposal: "regel" }).employeeSocial.rente.monthly).toBeCloseTo(768.18, 2);
  });

  it("income-based variant is 18,6 % of profit, capped at BBG", () => {
    expect(se({ rvProposal: "einkommen" }).employeeSocial.rente.monthly).toBeCloseTo(744, 2);
    expect(
      se({ rvProposal: "einkommen", grossAmount: 20_000 }).employeeSocial.rente.monthly,
    ).toBeCloseTo(8_450 * 0.186, 2);
  });

  it("GKV: full contribution with minimum assessment base", () => {
    const r = se({ grossAmount: 500 });
    expect(r.employeeSocial.kranken.monthly).toBeCloseTo((3_955 / 3) * 0.171, 2);
  });

  it("net = profit − taxes − contributions", () => {
    const r = se();
    expect(r.net.yearly).toBeCloseTo(
      r.gross.yearly - r.tax.total.yearly - r.employeeSocial.total.yearly,
      4,
    );
  });
});
