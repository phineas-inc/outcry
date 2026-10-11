export const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const signed = (n: number) => `${n > 0 ? "+" : ""}${fmt.format(n)}`;
export const dayNumber = (startDate: string) => Math.max(1, Math.floor((Date.now() - +new Date(startDate)) / 86_400_000) + 1);
export const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60_000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
export const placeOf = (p: { city: string; country: string }) => (p.city === p.country ? `${p.country} (nationwide)` : `${p.city}, ${p.country}`);
export const hoursAgo = (iso: string) => Math.max(1, Math.round((Date.now() - +new Date(iso)) / 3_600_000));
