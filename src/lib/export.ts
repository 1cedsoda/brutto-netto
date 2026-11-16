// Render a scenario (inputs + computed result) as plain text for pasting into
// other tools / AI systems.

import type {
  JobKind,
  JobTreatment,
  LineItem,
  ScenarioInput,
  ScenarioResult,
} from "./tax/types";
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

const KIND_LABEL: Record<JobKind, string> = {
  employee: "Angestellt",
  minijob: "Minijob",
  self: "Selbstständig",
};

export const TREATMENT_LABEL: Record<JobTreatment, string> = {
  main: "Hauptbeschäftigung",
  midijob: "Hauptbeschäftigung (Übergangsbereich/Midijob)",
  side: "Nebenbeschäftigung, Steuerklasse VI",
  minijob: "Minijob (pauschal)",
  "minijob-combined": "Minijob, mit Hauptjob zusammengerechnet (SV-pflichtig)",
  self: "Selbstständig",
};

function inputsBlock(input: ScenarioInput, res: ScenarioResult): string {
  const state = STATES.find((s) => s.id === input.bundesland)?.label ?? input.bundesland;
  const per = input.grossPeriod === "monthly" ? "Monat" : "Jahr";
  const lines: string[] = [
    `Steuerjahr: ${input.year}`,
    `Steuerklasse: ${ROMAN[input.steuerklasse]}`,
    `Bundesland: ${state}`,
    `Alter: ${input.age}`,
    `Kinder: ${input.children}`,
    `Kirchensteuer: ${yn(input.church)}`,
    `Gesetzlich renten-/arbeitslosenversichert: ${yn(input.pensionInsured)}`,
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
  lines.push(`Jobs / Einkünfte:`);
  res.jobs.forEach(({ job, index, treatment }) => {
    const emp: string[] = [];
    if (job.kind !== "self") {
      if (job.employer.insolvenzgeld) emp.push("U3");
      if (job.employer.u1Pct) emp.push(`U1 ${job.employer.u1Pct} %`);
      if (job.employer.u2Pct) emp.push(`U2 ${job.employer.u2Pct} %`);
      if (job.employer.unfallPct) emp.push(`BG ${job.employer.unfallPct} %`);
    }
    lines.push(
      `  ${index + 1}. ${KIND_LABEL[job.kind]}: ${formatEUR(job.grossAmount)} / ${per} — ${TREATMENT_LABEL[treatment]}` +
        (emp.length ? ` (Umlagen: ${emp.join(", ")})` : ""),
    );
    if (job.kind === "self") {
      lines.push(
        input.rvCommission
          ? `     Rente nach VORSCHLAG der Rentenkommission (kein geltendes Recht): ${
              { gruender: "halber Regelbeitrag", regel: "Regelbeitrag", einkommen: "einkommensbezogen" }[
                input.rvProposal
              ]
            }`
          : "     Rente: geltendes Recht (keine Pflichtversicherung)",
      );
    }
  });
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
  res: ScenarioResult,
  title = "Szenario",
): string {
  const result = res.total;
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
  out.push(inputsBlock(input, res));
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
  if (res.jobs.length > 1) {
    out.push("PRO JOB (Abrechnung des jeweiligen Arbeitgebers)");
    res.jobs.forEach(({ index, job, result: r }) => {
      out.push(
        `  ${index + 1}. ${KIND_LABEL[job.kind]}: Brutto ${formatEUR(r.gross.monthly)} · Steuern ${formatEUR(r.tax.total.monthly)} · SV ${formatEUR(r.employeeSocial.total.monthly)} · Netto ${formatEUR(r.net.monthly)} · AG-Kosten ${formatEUR(r.employerTotalCost.monthly)} (je Monat)`,
      );
    });
    out.push("");
  }
  if (res.annual) {
    const a = res.annual;
    out.push("STEUERERKLÄRUNG (Jahr)");
    out.push(`  Einkommensteuer inkl. Soli/KiSt: ${formatEUR(a.total)}`);
    out.push(`  Bereits einbehaltene Lohnsteuer: ${formatEUR(a.withheld)}`);
    out.push(
      a.balance >= 0
        ? `  Voraussichtliche Nachzahlung: ${formatEUR(a.balance)}`
        : `  Voraussichtliche Erstattung: ${formatEUR(-a.balance)}`,
    );
    out.push("");
  }
  out.push(`zu versteuerndes Einkommen: ${formatEUR(result.meta.zvE)} / Jahr`);
  out.push(`Vorsorgepauschale: ${formatEUR(result.meta.vorsorgepauschale)} / Jahr`);
  if (result.meta.notes.length) {
    out.push("");
    out.push("Hinweise:");
    result.meta.notes.forEach((n) => out.push(`  - ${n}`));
  }
  return out.join("\n");
}
