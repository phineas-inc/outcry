import { currentLocale } from "./i18n";

const cache = new Map<string, Intl.NumberFormat>();
const compact = (loc: string) => cache.get(loc) ?? cache.set(loc, new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 })).get(loc)!;

/** Compact numbers in the active language (12K / 12 Tsd.). */
export const fmt = { format: (n: number) => compact(currentLocale()).format(n) };
export const signed = (n: number) => `${n > 0 ? "+" : ""}${fmt.format(n)}`;
export const dayNumber = (startDate: string) => Math.max(1, Math.floor((Date.now() - +new Date(startDate)) / 86_400_000) + 1);
export const hoursAgo = (iso: string) => Math.max(1, Math.round((Date.now() - +new Date(iso)) / 3_600_000));
/** Minutes/hours/days since `iso` as [unit key, value]; callers translate with t(). */
export const agoParts = (iso: string): ["ago.min" | "ago.h" | "ago.d", number] => {
  const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60_000));
  return m < 60 ? ["ago.min", m] : m < 1440 ? ["ago.h", Math.round(m / 60)] : ["ago.d", Math.round(m / 1440)];
};
