// German payroll constants, parameterised by calendar year.
// Sources: §32a EStG (Steuerfortentwicklungsgesetz), SV-Rechengrößenverordnung,
// Beitragssätze GKV/SPV, SolzG — for the years 2025, 2026 and 2027.
//
// 2027 (Stand 16.11.2026): several values are not yet final law —
//  • Tarif, Arbeitnehmer-Pauschbetrag, Kinderfreibetrag, Minijob-Pauschsteuer:
//    Regierungsentwurf Einkommensteuerreformgesetz 2027 (BT-Drs. 21/8235)
//  • BBG / JAEG: SV-Rechengrößenverordnung 2027 (Kabinett, Bundesrat 20.11.2026)
//  • Kinderlosenzuschlag 0,9 %: Pflegeneuordnungsgesetz (Kabinettsentwurf)
//  • Ø-Zusatzbeitrag 2,9 % (BAnz AT 30.10.2026), Minijob-Grenze 633 € (Mindestlohn 14,60 €)

export type TaxYear = 2025 | 2026 | 2027;

export interface TariffParams {
  /** Grundfreibetrag */
  gfb: number;
  /** end of zone 2 (upper bound of lower progression) */
  z2End: number;
  z2A: number;
  z2B: number;
  /** end of zone 3 (start of 42% zone) */
  z3End: number;
  z3A: number;
  z3B: number;
  z3C: number;
  /** end of zone 4 (start of 45% "Reichensteuer") */
  z4End: number;
  z4C: number; // 0.42·x − z4C
  z5C: number; // 0.45·x − z5C
  /** end of zone 5 (start of 47% zone, from 2027) — omitted: no 47% zone */
  z5End?: number;
  z6C?: number; // 0.47·x − z6C
}

export interface YearConstants {
  year: TaxYear;
  /** true while the figures for this year are based on drafts, not final law */
  provisional: boolean;
  tariff: TariffParams;

  // Beitragsbemessungsgrenzen (annual EUR)
  bbgRv: number; // Renten- & Arbeitslosenversicherung
  bbgKv: number; // Kranken- & Pflegeversicherung
  jaeg: number; // Versicherungspflichtgrenze (info)
  /** Bezugsgröße (West/einheitlich), monthly EUR — basis of the Regelbeitrag */
  bezugsgroesse: number;

  // Contribution rates (total, %)
  rvRate: number;
  alvRate: number;
  kvRate: number;
  pvRate: number;

  // Pflege specials
  pvChildlessSurcharge: number;
  pvChildDiscount: number;
  pvSachsenEmployeeExtra: number;

  // Employer-only
  insolvenzgeld: number;

  // Minijob (geringfügige Beschäftigung)
  minijobLimit: number; // monthly earnings ceiling (Geringfügigkeitsgrenze)
  /** Übergangsbereich (Midijob): upper bound, monthly EUR */
  midijobUpper: number;
  /** Faktor F for the Übergangsbereich formula (§20a SGB IV) */
  faktorF: number;
  minijobRvPauschal: number; // employer flat pension rate, %
  minijobKvPauschal: number; // employer flat health rate (only if GKV), %
  minijobPauschsteuer: number; // employer flat tax (LSt+Soli+KiSt), %

  // Income tax allowances
  arbeitnehmerPauschbetrag: number;
  sonderausgabenPauschbetrag: number;
  entlastungAlleinerziehend: number;
  entlastungAlleinerziehendExtra: number;
  kinderfreibetragFull: number;

  // Solidaritätszuschlag
  soliRate: number;
  soliFreigrenze: number;
  soliFreigrenzeIII: number;
  soliMilderung: number;

  // Vorsorgepauschale
  vorsorgeKvBase: number;
  vorsorgeMindestRate: number;
  vorsorgeMindestCap: number;
  vorsorgeMindestCapIII: number;

  /** average GKV supplementary rate for the year (default for new inputs) */
  defaultZusatz: number;
}

const COMMON = {
  rvRate: 18.6,
  alvRate: 2.6,
  kvRate: 14.6,
  pvRate: 3.6,
  pvChildlessSurcharge: 0.6,
  pvChildDiscount: 0.25,
  pvSachsenEmployeeExtra: 0.5,
  insolvenzgeld: 0.15,
  minijobRvPauschal: 15,
  midijobUpper: 2_000,
  minijobKvPauschal: 13,
  minijobPauschsteuer: 2,
  arbeitnehmerPauschbetrag: 1_230,
  sonderausgabenPauschbetrag: 36,
  entlastungAlleinerziehend: 4_260,
  entlastungAlleinerziehendExtra: 240,
  soliRate: 5.5,
  soliMilderung: 0.119,
  vorsorgeKvBase: 7.0,
  vorsorgeMindestRate: 12,
  vorsorgeMindestCap: 1_900,
  vorsorgeMindestCapIII: 3_000,
} as const;

const YEARS: Record<TaxYear, YearConstants> = {
  2025: {
    ...COMMON,
    year: 2025,
    provisional: false,
    tariff: {
      gfb: 12_096,
      z2End: 17_443,
      z2A: 932.3,
      z2B: 1_400,
      z3End: 68_480,
      z3A: 176.64,
      z3B: 2_397,
      z3C: 1_015.13,
      z4End: 277_825,
      z4C: 10_911.92,
      z5C: 19_246.67,
    },
    bbgRv: 96_600,
    bbgKv: 66_150,
    jaeg: 73_800,
    bezugsgroesse: 3_745,
    kinderfreibetragFull: 9_600,
    soliFreigrenze: 19_950,
    soliFreigrenzeIII: 39_900,
    defaultZusatz: 2.5,
    minijobLimit: 556,
    faktorF: 0.6683,
  },
  2026: {
    ...COMMON,
    year: 2026,
    provisional: false,
    tariff: {
      gfb: 12_348,
      z2End: 17_799,
      z2A: 914.51,
      z2B: 1_400,
      z3End: 69_878,
      z3A: 173.1,
      z3B: 2_397,
      z3C: 1_034.87,
      z4End: 277_825,
      z4C: 11_135.63,
      z5C: 19_470.38,
    },
    bbgRv: 101_400, // 8.450 €/Monat
    bbgKv: 69_750, // 5.812,50 €/Monat
    jaeg: 77_400,
    bezugsgroesse: 3_955,
    kinderfreibetragFull: 9_756,
    soliFreigrenze: 20_350,
    soliFreigrenzeIII: 40_700,
    defaultZusatz: 2.9,
    minijobLimit: 603,
    faktorF: 0.6619,
  },
  2027: {
    ...COMMON,
    year: 2027,
    provisional: true,
    tariff: {
      gfb: 12_564,
      z2End: 17_799,
      z2A: 952.24,
      z2B: 1_400,
      z3End: 70_600,
      z3A: 170.74,
      z3B: 2_397,
      z3C: 993.86,
      z4End: 249_999,
      z4C: 11_241.73,
      z5End: 279_999,
      z5C: 18_741.7,
      z6C: 24_341.68,
    },
    bbgRv: 106_200, // 8.850 €/Monat
    bbgKv: 76_500, // 6.375 €/Monat (inkl. Sonderanhebung +300 €/Monat)
    jaeg: 84_150,
    bezugsgroesse: 4_130,
    pvChildlessSurcharge: 0.9,
    arbeitnehmerPauschbetrag: 1_430,
    kinderfreibetragFull: 10_056,
    soliFreigrenze: 20_350,
    soliFreigrenzeIII: 40_700,
    defaultZusatz: 2.9,
    minijobLimit: 633,
    faktorF: 0.7683, // voraussichtlich; neue Formel (14,6 % + Ø-ZB + 15 %) / GSV-Satz
    minijobKvPauschal: 17.5, // 14,6 % + Ø-Zusatzbeitrag 2,9 %
    minijobPauschsteuer: 5,
  },
};

export const TAX_YEARS: TaxYear[] = [2025, 2026, 2027];

/** The calendar year of `date`, clamped to the supported tax years. */
export function currentTaxYear(date: Date = new Date()): TaxYear {
  const y = date.getFullYear();
  const min = TAX_YEARS[0];
  const max = TAX_YEARS[TAX_YEARS.length - 1];
  if (y <= min) return min;
  if (y >= max) return max;
  return (TAX_YEARS.find((t) => t === y) ?? max) as TaxYear;
}

export function getConstants(year: TaxYear): YearConstants {
  return YEARS[year] ?? YEARS[currentTaxYear()];
}

export const STATES: { id: string; label: string; kistRate: 8 | 9 }[] = [
  { id: "BW", label: "Baden-Württemberg", kistRate: 8 },
  { id: "BY", label: "Bayern", kistRate: 8 },
  { id: "BE", label: "Berlin", kistRate: 9 },
  { id: "BB", label: "Brandenburg", kistRate: 9 },
  { id: "HB", label: "Bremen", kistRate: 9 },
  { id: "HH", label: "Hamburg", kistRate: 9 },
  { id: "HE", label: "Hessen", kistRate: 9 },
  { id: "MV", label: "Mecklenburg-Vorpommern", kistRate: 9 },
  { id: "NI", label: "Niedersachsen", kistRate: 9 },
  { id: "NW", label: "Nordrhein-Westfalen", kistRate: 9 },
  { id: "RP", label: "Rheinland-Pfalz", kistRate: 9 },
  { id: "SL", label: "Saarland", kistRate: 9 },
  { id: "SN", label: "Sachsen", kistRate: 9 },
  { id: "ST", label: "Sachsen-Anhalt", kistRate: 9 },
  { id: "SH", label: "Schleswig-Holstein", kistRate: 9 },
  { id: "TH", label: "Thüringen", kistRate: 9 },
];

/** Common statutory health funds with an indicative supplementary rate (Zusatzbeitrag). */
export const KRANKENKASSEN: { id: string; label: string; zusatz: number }[] = [
  { id: "tk", label: "Techniker Krankenkasse (TK)", zusatz: 2.45 },
  { id: "barmer", label: "Barmer", zusatz: 3.29 },
  { id: "dak", label: "DAK-Gesundheit", zusatz: 2.8 },
  { id: "aok-by", label: "AOK Bayern", zusatz: 2.5 },
  { id: "aok-nw", label: "AOK Rheinland/Hamburg", zusatz: 3.2 },
  { id: "hkk", label: "hkk Krankenkasse", zusatz: 2.19 },
  { id: "ikk", label: "IKK classic", zusatz: 3.4 },
  { id: "average", label: "Durchschnitt (gesetzlich)", zusatz: 2.9 },
  { id: "custom", label: "Eigener Wert", zusatz: 2.5 },
];
