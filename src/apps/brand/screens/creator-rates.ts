/* Creator rates, shared by the creator cards on #home and #creators (and the creator kit, LLD.ck).
   Rates are integer paise keyed by format ("reel", "story", "video"…). A creator with no usable rate shows
   "Rate on request" everywhere, never "₹∞": the lowest rate is only taken over a non-empty list. */

export type Rates = Record<string, unknown> | null | undefined;

export const RATE_ON_REQUEST = "Rate on request";

/** The usable rates, optionally only the given formats ("Reel", "Video"…). Zero, missing and non-numbers are dropped. */
export function rateList(rates: Rates, types?: string[] | null): [string, number][] {
  return Object.entries(rates || {})
    .filter(([k]) => !types || !types.length || types.some(t => t.toLowerCase() === k))
    .map(([k, v]): [string, number] => [k, Number(v)])
    .filter(([, v]) => Number.isFinite(v) && v > 0);
}

/** The cheapest rate as { fmt: "Reel", price }, or null when there is none. */
export function lowestRate(rates: Rates, types?: string[] | null): { fmt: string; price: number } | null {
  const r = rateList(rates, types).sort((a, b) => a[1] - b[1])[0];
  return r ? { fmt: r[0].charAt(0).toUpperCase() + r[0].slice(1), price: r[1] } : null;
}

/** True when the creator has listed at least one rate, for any format. */
export const hasRates = (rates: Rates): boolean => rateList(rates).length > 0;
