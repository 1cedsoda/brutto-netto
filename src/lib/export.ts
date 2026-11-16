// Render a scenario (inputs + computed result) as plain text for pasting into
// other tools / AI systems.

import type { CalculationResult, LineItem, ScenarioInput } from "./tax/types";
import { STATES, KRANKENKASSEN } from "./tax/constants";
import { formatEUR, formatShare } from "./format";

const ROMAN: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
};

const HEALTH_LABEL: Record<ScenarioInput["health"]["kind"], string> = {
  gkv: "Gesetzlich (GKV)",
  pkv_zuschuss: "Privat (PKV) mit Arbeitgeberzuschuss",
  pkv: "Privat (PKV) ohne Arbeitgeberzuschuss",
};

const yn = (b: boolean) => (b ? "ja" : "nein");

function inputsBlock(input: ScenarioInput): string {
  const state = STATES.find((s) => s.id === input.bundesland)?.label ?? input.bundesland;
  const lines: string[] = [
    `Steuerjahr: ${input.year}`,
    `${input.selfEmployed ? "Bruttoeinkommen" : "Bruttogehalt"}: ${formatEUR(input.grossAmount)} / ${input.grossPeriod === "monthly" ? "Monat" : "Jahr"}`,
    `Steuerklasse: ${ROMAN[input.steuerklasse]}`,
    `Bundesland: ${state}`,
    `Alter: ${input.age}`,
    `Kinder: ${input.children}`,
    `Kirchensteuer: ${yn(input.church)}`,
    `Minijob: ${yn(input.minijob)}`,
    `Selbstständig: ${yn(input.selfEmployed)}${
      input.selfEmployed
        ? ` (Rente nach VORSCHLAG der Rentenkommission, kein geltendes Recht: ${
            { gruender: "halber Regelbeitrag", regel: "Regelbeitrag", einkommen: "einkommensbezogen" }[
              input.rvProposal
            ]
          })`
        : ""
    }`,
    `Gesetzlich rentenversichert: ${yn(input.pensionInsured)}`,
    `Krankenversicherung: ${HEALTH_LABEL[input.health.kind]}`,
  ];
  if (input.health.kind === "gkv") {
    const fund = KRANKENKASSEN.find((k) => k.id === input.health.fundId)?.label;
    lines.push(
      `  Krankenkasse: ${fund ?? "—"} (Zusatzbeitrag ${input.health.zusatzbeitragPct.toLocaleString("de-DE")} %)`,
    );
  } else {
    lines.push(`  PKV-Prämie: ${formatEUR(input.health.privateMonthlyPremium)} / Monat`);
    lines.push(`  Basistarif-Anteil (steuerlich): ${input.health.basisPct} %`);
  }
  const emp: string[] = [];
  if (input.employer.insolvenzgeld) emp.push("Insolvenzgeldumlage (U3)");
  if (input.employer.u1Pct) emp.push(`U1 ${input.employer.u1Pct} %`);
  if (input.employer.u2Pct) emp.push(`U2 ${input.employer.u2Pct} %`);
  if (input.employer.unfallPct) emp.push(`Unfallvers. ${input.employer.unfallPct} %`);
  lines.push(`Arbeitgeber-Umlagen: ${emp.length ? emp.join(", ") : "keine"}`);
  return lines.join("\n");
}

function row(item: { monthly: number; yearly: number }, base?: number): string {
  const share = base ? `  (${formatShare(item.monthly, base)})` : "";
  return `${formatEUR(item.monthly)} / Monat · ${formatEUR(item.yearly)} / Jahr${share}`;
}

function item(it: LineItem, base?: number): string | null {
  if (it.monthly === 0 && !it.ratePct) return null;
  const rate = it.ratePct ? ` [${it.ratePct.toLocaleString("de-DE")} %]` : "";
  return `  - ${it.label}${rate}: ${row(it, base)}`;
}

export function scenarioToText(
  input: ScenarioInput,
  result: CalculationResult,
  title = "Szenario",
): string {
  const base = result.employerTotalCost.monthly;
  const e = result.employeeSocial;
  const a = result.employerSocial;

  const out: string[] = [];
  out.push(`### ${title} — Brutto-Netto Deutschland ${result.meta.year}`);
  if (result.meta.proposal) {
    out.push(
      "⚠ Enthält den Vorschlag der Rentenkommission (Empfehlung 22, 23.06.2026) – kein geltendes Recht.",
    );
  }
  out.push("");
  out.push("EINGABEN");
  out.push(inputsBlock(input));
  out.push("");
  out.push("ERGEBNIS (Bezug: Arbeitgeber-Gesamtkosten = 100 %)");
  out.push(`Bruttolohn: ${row(result.gross, base)}`);
  out.push(`Netto (Arbeitnehmer): ${row(result.net, base)}`);
  out.push(
    `Steuern & Abgaben gesamt: ${row(
      {
        monthly: base - result.net.monthly,
        yearly: result.employerTotalCost.yearly - result.net.yearly,
      },
      base,
    )}`,
  );
  out.push(`Arbeitgeber-Gesamtkosten: ${row(result.employerTotalCost, base)}`);
  out.push("");
  out.push("Steuern (Arbeitnehmer):");
  [result.tax.lohnsteuer, result.tax.soli, result.tax.kirchensteuer]
    .map((i) => item(i, base))
    .filter(Boolean)
    .forEach((l) => out.push(l as string));
  out.push("");
  out.push("Sozialabgaben Arbeitnehmer:");
  [e.rente, e.arbeitslosen, e.kranken, e.pflege]
    .map((i) => item(i, base))
    .filter(Boolean)
    .forEach((l) => out.push(l as string));
  if (result.privateHealthEmployee) {
    out.push(item(result.privateHealthEmployee, base) as string);
  }
  out.push("");
  out.push("Arbeitgeberanteil:");
  [a.rente, a.arbeitslosen, a.kranken, a.pflege, a.insolvenzgeld, a.u1, a.u2, a.unfall, a.pauschsteuer]
    .map((i) => item(i, base))
    .filter(Boolean)
    .forEach((l) => out.push(l as string));
  out.push("");
  out.push(`zu versteuerndes Einkommen: ${formatEUR(result.meta.zvE)} / Jahr`);
  out.push(`Vorsorgepauschale: ${formatEUR(result.meta.vorsorgepauschale)} / Jahr`);
  if (result.meta.notes.length) {
    out.push("");
    out.push("Hinweise:");
    result.meta.notes.forEach((n) => out.push(`  - ${n}`));
  }
  return out.join("\n");
}
