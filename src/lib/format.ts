const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eur0 = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct1 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct0 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatEUR = (n: number) => eur.format(n);
export const formatEUR0 = (n: number) => eur0.format(n);
export const formatPct = (n: number) => `${pct.format(n)} %`;

/**
 * A value's share of a base, e.g. 3125.75 of 5000 → "62,5 %". Empty if base ≈ 0.
 * Shares of 10 % and above are shown without decimals.
 */
export function formatShare(value: number, base: number): string {
  if (Math.abs(base) < 0.005) return "";
  const p = (value / base) * 100;
  return `${(Math.abs(p) >= 10 ? pct0 : pct1).format(p)} %`;
}

/** Signed currency with explicit + / − for difference views. */
export function formatDelta(n: number): string {
  const sign = n > 0.005 ? "+" : n < -0.005 ? "−" : "";
  return `${sign}${eur.format(Math.abs(n))}`;
}
