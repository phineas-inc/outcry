export const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const signed = (n: number) => `${n > 0 ? "+" : ""}${fmt.format(n)}`;
export const dayNumber = (startDate: string) => Math.max(1, Math.floor((Date.now() - +new Date(startDate)) / 86_400_000) + 1);
export const hoursAgo = (iso: string) => Math.max(1, Math.round((Date.now() - +new Date(iso)) / 3_600_000));
