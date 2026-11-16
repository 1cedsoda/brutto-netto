// Selbstständige / Gründer:innen — Rentenversicherungspflicht nach dem
// VORSCHLAG der Rentenkommission (Alterssicherungskommission, Bericht vom
// 23.06.2026, Empfehlung 22). Das ist KEIN geltendes Recht: Es gibt (Stand
// November 2026) keinen Gesetzentwurf, Stichtag und Details sind offen.
//
// Modell:
//  • Rente: Regelbeitrag (Beitragssatz × Bezugsgröße) wie bei pflichtversicherten
//    Handwerkern, in den ersten drei Jahren nach Gründung der halbe Regelbeitrag,
//    wahlweise einkommensbezogen (Beitragssatz × Gewinn, bis zur BBG).
//  • Kranken-/Pflegeversicherung: geltendes Recht für freiwillig GKV-Versicherte
//    (voller Beitrag, Mindestbemessung = Bezugsgröße / 3) bzw. volle PKV-Prämie.
//  • Keine Arbeitslosenversicherung, kein Arbeitgeber.
//  • Einkommensteuer auf den Gewinn nach Abzug der Vorsorgeaufwendungen;
//    keine Gewerbesteuer (z. B. Freiberufler) und kein Arbeitnehmer-Pauschbetrag.

import type { YearConstants } from "./constants";
import { STATES } from "./constants";
import {
  bemessungForSoliKist,
  kirchensteuerAnnual,
  lohnsteuerAnnual,
  soliAnnual,
} from "./income-tax";
import { pflegeRates } from "./social";
import type { CalculationResult, LineItem, RvProposal, ScenarioInput } from "./types";

export const PROPOSAL_NOTE =
  "Rentenversicherung nach dem VORSCHLAG der Rentenkommission (Alterssicherungskommission, Empfehlung 22, Bericht vom 23.06.2026) – kein geltendes Recht, Gesetzentwurf und Stichtag stehen aus.";

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

const eur = (v: number) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Monthly Regelbeitrag (rounded to cents) for the given year. */
export function regelbeitragMonthly(C: YearConstants): number {
  return Math.round(C.bezugsgroesse * C.rvRate) / 100;
}

/** Annual pension contribution under the Rentenkommission proposal. */
export function proposalPensionAnnual(
  variant: RvProposal,
  profitAnnual: number,
  C: YearConstants,
): number {
  switch (variant) {
    case "regel":
      return regelbeitragMonthly(C) * 12;
    case "gruender":
      return (Math.round((regelbeitragMonthly(C) / 2) * 100) / 100) * 12;
    case "einkommen":
      return (Math.min(Math.max(0, profitAnnual), C.bbgRv) * C.rvRate) / 100;
  }
}

export function calculateSelfEmployed(
  input: ScenarioInput,
  profitAnnual: number,
  C: YearConstants,
  baseNotes: string[],
): CalculationResult {
  const profit = Math.max(0, profitAnnual);

  // ── Rente: geltendes Recht (keine Pflicht) oder Vorschlag der Rentenkommission ──
  const proposal = input.rvCommission;
  const rvYearly = proposal ? proposalPensionAnnual(input.rvProposal, profit, C) : 0;
  const rvNote = !proposal
    ? "Geltendes Recht: keine Rentenversicherungspflicht (außer z. B. Lehrkräfte, Handwerker, KSK)"
    : input.rvProposal === "regel"
      ? `Regelbeitrag ${eur(regelbeitragMonthly(C))} €/Monat (${C.rvRate} % × Bezugsgröße ${eur(C.bezugsgroesse)} €)`
      : input.rvProposal === "gruender"
        ? `Halber Regelbeitrag für Gründer:innen (erste 3 Jahre): ${eur(regelbeitragMonthly(C) / 2)} €/Monat`
        : `Einkommensbezogen: ${C.rvRate} % vom Gewinn (bis BBG ${eur(C.bbgRv / 12)} €/Monat)`;

  // ── Kranken-/Pflegeversicherung (freiwillig GKV bzw. PKV, geltendes Recht) ──
  const isGkv = input.health.kind === "gkv";
  const kvMinBase = (C.bezugsgroesse / 3) * 12; // Mindestbemessungsgrundlage
  const kvBase = Math.min(Math.max(profit, kvMinBase), C.bbgKv);
  const kvRate = C.kvRate + input.health.zusatzbeitragPct;
  const pf = pflegeRates({ ...input, bundesland: "NW" }, C); // no Saxony split w/o employer
  const pvRate = pf.employee + pf.employer;
  const kvYearly = isGkv ? (kvBase * kvRate) / 100 : 0;
  const pvYearly = isGkv ? (kvBase * pvRate) / 100 : 0;
  const pkvYearly = isGkv ? 0 : input.health.privateMonthlyPremium * 12;

  // ── Einkommensteuer ──
  // Vorsorgeaufwendungen: RV voll, KV ohne Krankengeld-Anteil (−4 %), PV voll;
  // bei PKV nur die Basisabsicherung.
  const kvpvDeductible = isGkv
    ? kvYearly * 0.96 + pvYearly
    : pkvYearly * (input.health.basisPct / 100);
  const vorsorge = rvYearly + kvpvDeductible;
  const klasse = input.steuerklasse === 3 ? 3 : 1; // Splitting nur bei StKl III
  const entlastung =
    input.steuerklasse === 2 && input.children >= 1
      ? C.entlastungAlleinerziehend +
        C.entlastungAlleinerziehendExtra * (input.children - 1)
      : 0;
  const zvE = Math.max(
    0,
    Math.floor(profit - C.sonderausgabenPauschbetrag - vorsorge - entlastung),
  );
  const est = lohnsteuerAnnual(zvE, klasse, C);
  const units = input.children > 0 ? input.children : 0;
  const soliBase = units > 0 ? bemessungForSoliKist(zvE, klasse, units, C) : est;
  const soli = soliAnnual(soliBase, klasse, C);
  const kistRate = STATES.find((s) => s.id === input.bundesland)?.kistRate ?? 9;
  const kist = input.church ? kirchensteuerAnnual(soliBase, kistRate) : 0;
  const taxTotal = est + soli + kist;

  const socialTotal = rvYearly + kvYearly + pvYearly;
  const net = profit - taxTotal - socialTotal - pkvYearly;
  const zero = (key: string, label: string) => mk(key, label, 0);

  const notes = [
    proposal
      ? PROPOSAL_NOTE
      : "Rentenversicherung: geltendes Recht – die meisten Selbstständigen sind nicht pflichtversichert, hier ohne Rentenbeitrag gerechnet.",
    ...baseNotes,
    "Selbstständig: Bruttoeinkommen = Gewinn vor Steuern; kein Arbeitgeberanteil, keine Arbeitslosenversicherung.",
    isGkv
      ? `Krankenversicherung: freiwillig gesetzlich mit vollem Beitrag (${eur(kvRate)} % + Pflege ${eur(pvRate)} %), mindestens auf ${eur(kvMinBase / 12)} €/Monat.`
      : "PKV: volle Prämie ohne Arbeitgeberzuschuss.",
    "Einkommensteuer ohne Gewerbesteuer (z. B. Freiberufler), Steuerklasse III = Splitting ohne Partnereinkommen.",
  ];
  if (proposal && input.rvProposal === "gruender") {
    notes.push(
      "Halber Regelbeitrag laut Vorschlag nur bei erstmaliger Gründung im Erwerbsleben und nur für drei Jahre.",
    );
  }

  return {
    gross: { monthly: profit / 12, yearly: profit },
    tax: {
      lohnsteuer: mk("lohnsteuer", "Einkommensteuer", est),
      soli: mk("soli", "Solidaritätszuschlag", soli),
      kirchensteuer: mk("kist", "Kirchensteuer", kist, {
        ratePct: input.church ? kistRate : undefined,
      }),
      total: mk("tax-total", "Steuern gesamt", taxTotal),
    },
    employeeSocial: {
      rente: mk(
        "rv-an",
        proposal ? "Rentenversicherung (Vorschlag Rentenkommission)" : "Rentenversicherung",
        rvYearly,
        {
        ratePct: proposal && input.rvProposal === "einkommen" ? C.rvRate : undefined,
        note: rvNote,
        },
      ),
      arbeitslosen: zero("alv-an", "Arbeitslosenversicherung"),
      kranken: mk("kv-an", "Krankenversicherung", kvYearly, {
        ratePct: isGkv ? kvRate : undefined,
      }),
      pflege: mk("pv-an", "Pflegeversicherung", pvYearly, {
        ratePct: isGkv ? pvRate : undefined,
      }),
      total: mk("soc-an-total", "Sozialabgaben gesamt", socialTotal),
    },
    privateHealthEmployee: isGkv
      ? undefined
      : mk("pkv-an", "Private Krankenversicherung", pkvYearly),
    net: { monthly: net / 12, yearly: net },
    employerSocial: {
      rente: zero("rv-ag", "Rentenversicherung"),
      arbeitslosen: zero("alv-ag", "Arbeitslosenversicherung"),
      kranken: zero("kv-ag", "Krankenversicherung"),
      pflege: zero("pv-ag", "Pflegeversicherung"),
      insolvenzgeld: zero("u3-ag", "Insolvenzgeldumlage (U3)"),
      u1: zero("u1-ag", "Umlage U1 (Krankheit)"),
      u2: zero("u2-ag", "Umlage U2 (Mutterschaft)"),
      unfall: zero("unfall-ag", "Unfallversicherung (BG)"),
      pauschsteuer: zero("pausch-ag", "Pauschsteuer"),
      total: zero("soc-ag-total", "Arbeitgeberanteil gesamt"),
    },
    // No employer: the "total cost" reference is the profit itself.
    employerTotalCost: { monthly: profit / 12, yearly: profit },
    meta: {
      year: C.year,
      zvE,
      vorsorgepauschale: vorsorge,
      approximate: false,
      provisional: C.provisional,
      proposal,
      selfEmployed: true,
      notes,
    },
  };
}
