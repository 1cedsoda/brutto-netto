# Brutto-Netto-Rechner

Brutto-Netto-Rechner für Deutschland: Arbeitnehmer-Netto und Arbeitgeberkosten, monatlich und
jährlich, mit Vergleichsmodus. Alles wird im Browser berechnet. Es gibt kein Backend, kein
Tracking und keine Cookies. Eingaben bleiben im Local Storage.

## Steuerjahre

- **2025, 2026**: geltendes Recht.
- **2027**: teils **vorläufig** (Stand November 2026) und in der App so markiert. Tarif,
  Arbeitnehmer-Pauschbetrag, Kinderfreibetrag und Minijob-Pauschsteuer folgen dem
  Regierungsentwurf zum Einkommensteuerreformgesetz 2027, die Rechengrößen der
  SV-Rechengrößenverordnung 2027 (Kabinettsbeschluss), der Kinderlosenzuschlag dem
  Pflegeneuordnungsgesetz (Entwurf). Werte stehen in `src/lib/tax/constants.ts`.

Voreingestellt ist immer das aktuelle Kalenderjahr (auf die unterstützten Jahre begrenzt).

## Mehrere Jobs

Eine Person kann mehrere Einkünfte haben (Angestellt, Minijob, Selbstständig). Der erste Job
ist der Hauptjob. Umgesetzt (`src/lib/tax/scenario.ts`):

- Weitere Beschäftigungen laufen mit Steuerklasse VI.
- Sozialabgaben werden über alle Beschäftigungen zusammengerechnet; die
  Beitragsbemessungsgrenzen gelten für die Summe und werden anteilig verteilt.
- Der erste Minijob neben einem Hauptjob bleibt pauschal, jeder weitere wird zum Hauptjob
  addiert (SV-pflichtig, ohne Arbeitslosenversicherung). Mehrere Minijobs ohne Hauptjob werden
  zusammengerechnet.
- Übergangsbereich (Midijob, 603,01–2.000 €, Faktor F) auf das gemeinsame Entgelt.
- Selbstständigkeit neben einer Beschäftigung: Kranken-/Pflegeversicherung über den Job.
- Bei mehreren steuerpflichtigen Einkünften wird die Einkommensteuer fürs Jahr gemeinsam
  berechnet und mit der einbehaltenen Lohnsteuer verglichen (Erstattung/Nachzahlung).

Die Auswertung zeigt dann eine Spalte pro Job und den Jahresausgleich.

## Selbstständige: Vorschlag der Rentenkommission

Der Schalter „Selbstständig / Gründer:in" rechnet mit der Rentenversicherungspflicht, die die
Rentenkommission (Alterssicherungskommission, Empfehlung 22, Bericht vom 23.06.2026)
**vorschlägt**. Das ist **kein geltendes Recht**. Varianten: Regelbeitrag (Beitragssatz ×
Bezugsgröße, 2026: 735,63 €/Monat), halber Regelbeitrag in den ersten drei Jahren nach
Gründung, oder einkommensbezogen. Kranken- und Pflegeversicherung folgen geltendem Recht für
freiwillig gesetzlich Versicherte. Code: `src/lib/tax/self-employed.ts`.

Stack: Vite, React 19, Tailwind 4, shadcn/ui, Zustand, Recharts. Gehostet als assets-only
Cloudflare Worker.

## Entwicklung

```sh
bun install
bun run dev        # Vite-Dev-Server
bun test           # Tests der Steuer- und SV-Berechnung
bun run typecheck
```

## Deployment (Cloudflare Workers)

```sh
bunx wrangler login   # einmalig
bun run preview       # Build + lokaler Worker (wrangler dev)
bun run deploy        # Build + wrangler deploy
```

`wrangler.jsonc` liefert `dist/` als statische Assets aus. `/impressum` und `/datenschutz` sind
eigene HTML-Einstiegspunkte mit `noindex` (Meta-Tag und `X-Robots-Tag` in `public/_headers`).
Unbekannte Pfade fallen auf den Rechner zurück.

## Projektstruktur

```text
src/lib/tax/         Berechnung (Lohnsteuer, Soli, Kirchensteuer, Sozialversicherung) + Tests
src/components/calc/ Rechner-UI
src/legal/           Impressum und Datenschutzerklärung
```

## Hinweis

Alle Angaben ohne Gewähr. Das ist keine Steuer- oder Rechtsberatung.

## Lizenz

[MIT](./LICENSE)
