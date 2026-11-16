import { describe, it, expect } from "bun:test";
import { calculate } from "./calculate";
import { calculateScenario, classifyJobs } from "./scenario";
import type { Job, JobKind, ScenarioInput } from "./types";

const EMP = { insolvenzgeld: true, u1Pct: 0, u2Pct: 0, unfallPct: 0 };
const job = (kind: JobKind, grossAmount: number, id = `${kind}-${grossAmount}`): Job => ({
  id,
  kind,
  grossAmount,
  employer: { ...EMP },
});

const BASE: ScenarioInput = {
  year: 2026,
  grossPeriod: "monthly",
  steuerklasse: 1,
  bundesland: "NW",
  church: false,
  children: 0,
  age: 30,
  pensionInsured: true,
  health: {
    kind: "gkv",
    zusatzbeitragPct: 2.9,
    fundId: "average",
    privateMonthlyPremium: 700,
    basisPct: 85,
  },
  rvCommission: false,
  rvProposal: "gruender",
  jobs: [job("employee", 5000)],
};
const sc = (jobs: Job[], patch: Partial<ScenarioInput> = {}) =>
  calculateScenario({ ...BASE, ...patch, jobs });

const legacy = (kind: JobKind, gross: number) =>
  calculate({
    ...BASE,
    grossAmount: gross,
    minijob: kind === "minijob",
    selfEmployed: kind === "self",
    employer: EMP,
  });

describe("single job = legacy calculation", () => {
  it("employee", () => {
    const r = sc([job("employee", 5000)]);
    expect(r.annual).toBeNull();
    expect(r.total.net.monthly).toBeCloseTo(legacy("employee", 5000).net.monthly, 6);
  });
  it("minijob", () => {
    expect(sc([job("minijob", 500)]).total.net.monthly).toBeCloseTo(
      legacy("minijob", 500).net.monthly,
      6,
    );
  });
  it("self-employed", () => {
    expect(sc([job("self", 4000)]).total.net.monthly).toBeCloseTo(
      legacy("self", 4000).net.monthly,
      6,
    );
  });
});

describe("main job + Minijob", () => {
  const r = sc([job("employee", 5000), job("minijob", 500)]);
  it("first Minijob stays geringfügig and is not added", () => {
    expect(classifyJobs({ ...BASE, jobs: [job("employee", 5000), job("minijob", 500)] })).toEqual([
      "main",
      "minijob",
    ]);
    expect(r.jobs[0].result.net.monthly).toBeCloseTo(legacy("employee", 5000).net.monthly, 6);
    expect(r.jobs[1].result.employeeSocial.kranken.yearly).toBe(0);
    expect(r.jobs[1].result.employerSocial.pauschsteuer.monthly).toBeCloseTo(10, 6);
  });
  it("no mandatory tax return (Minijob is flat-taxed)", () => {
    expect(r.annual).toBeNull();
    expect(r.total.net.monthly).toBeCloseTo(
      r.jobs[0].result.net.monthly + r.jobs[1].result.net.monthly,
      6,
    );
  });
});

describe("second Minijob next to a main job", () => {
  const r = sc([job("employee", 3000), job("minijob", 300, "m1"), job("minijob", 300, "m2")]);
  it("is combined: SV-pflichtig except ALV, Steuerklasse VI", () => {
    const second = r.jobs[2];
    expect(second.treatment).toBe("minijob-combined");
    expect(second.steuerklasse).toBe(6);
    expect(second.result.employeeSocial.kranken.yearly).toBeGreaterThan(0);
    expect(second.result.employeeSocial.arbeitslosen.yearly).toBe(0);
    expect(second.result.tax.lohnsteuer.yearly).toBeGreaterThan(0); // StKl VI
  });
});

describe("two employments", () => {
  const r = sc([job("employee", 6000), job("employee", 4000)]);
  it("side job uses Steuerklasse VI", () => {
    expect(r.jobs[1].steuerklasse).toBe(6);
  });
  it("BBG applies to the sum (RV 8.450 €/Monat 2026), split pro rata", () => {
    const rv = r.jobs.reduce((a, j) => a + j.result.employeeSocial.rente.monthly, 0);
    expect(rv).toBeCloseTo(8450 * 0.093, 2);
    expect(r.jobs[0].result.employeeSocial.rente.monthly).toBeCloseTo(8450 * 0.6 * 0.093, 2);
  });
  it("tax return settles the StKl-VI over-withholding", () => {
    expect(r.annual).not.toBeNull();
    expect(r.total.tax.total.yearly).toBeCloseTo(r.annual!.total, 6);
    expect(r.annual!.withheld).toBeCloseTo(
      r.jobs[0].result.tax.total.yearly + r.jobs[1].result.tax.total.yearly,
      6,
    );
  });
});

describe("Übergangsbereich (Midijob)", () => {
  // 2026: G = 603, OG = 2.000, F = 0,6619; AE = 1.500 €
  const r = sc([job("employee", 1500)]);
  it("is detected", () => {
    expect(r.jobs[0].treatment).toBe("midijob");
  });
  it("employee RV on BE_AN = 2000/1397 × 897", () => {
    const beAn = (2000 / 1397) * 897;
    expect(r.total.employeeSocial.rente.monthly).toBeCloseTo(beAn * 0.093, 2);
  });
  it("employer RV = 18,6 % × BE − employee share", () => {
    const beAn = (2000 / 1397) * 897;
    const be = 0.6619 * 603 + (2000 / 1397 - (603 / 1397) * 0.6619) * 897;
    expect(r.total.employerSocial.rente.monthly).toBeCloseTo(be * 0.186 - beAn * 0.093, 2);
  });
  it("not applied above 2.000 €", () => {
    expect(sc([job("employee", 2100)]).jobs[0].treatment).toBe("main");
  });
});

describe("several Minijobs without a main job", () => {
  it("stay Minijobs while the sum is within the limit", () => {
    expect(sc([job("minijob", 300, "a"), job("minijob", 300, "b")]).jobs.map((j) => j.treatment)).toEqual([
      "minijob",
      "minijob",
    ]);
  });
  it("become regular employments above the limit", () => {
    const r = sc([job("minijob", 400, "a"), job("minijob", 400, "b")]);
    expect(r.jobs.map((j) => j.treatment)).toEqual(["midijob", "side"]);
    expect(r.total.employeeSocial.kranken.yearly).toBeGreaterThan(0);
  });
});

describe("employment + self-employment", () => {
  const r = sc([job("employee", 4000), job("self", 1500)]);
  it("KV/PV via the employment, nothing extra on self income", () => {
    expect(r.jobs[1].result.employeeSocial.kranken.yearly).toBe(0);
    expect(r.jobs[1].result.employeeSocial.pflege.yearly).toBe(0);
  });
  it("income tax assessed jointly → additional payment", () => {
    expect(r.annual).not.toBeNull();
    expect(r.annual!.balance).toBeGreaterThan(0);
    expect(r.jobs[1].result.tax.total.yearly).toBe(0);
  });
  it("Rentenkommission proposal applies to the self-employment only", () => {
    const p = sc([job("employee", 4000), job("self", 1500)], { rvCommission: true });
    expect(p.jobs[1].result.employeeSocial.rente.monthly).toBeCloseTo(367.82, 2);
    expect(p.total.meta.proposal).toBe(true);
    expect(r.total.meta.proposal).toBe(false);
  });
});
