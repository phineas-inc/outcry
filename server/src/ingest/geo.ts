import type { Fetch } from "./sources.ts";

export interface Place { lat: number; lng: number; continent: string }

const COUNTRY_ALIAS: Record<string, string> = {
  usa: "united states", us: "united states", "u.s.": "united states", "united states of america": "united states", america: "united states",
  uk: "united kingdom", britain: "united kingdom", "great britain": "united kingdom", england: "united kingdom", scotland: "united kingdom", wales: "united kingdom",
  "south korea": "south korea", "north korea": "north korea", russia: "russia", "russian federation": "russia", "czech republic": "czechia",
  "ivory coast": "côte d'ivoire", turkiye: "turkey", türkiye: "turkey", drc: "democratic republic of the congo", "dr congo": "democratic republic of the congo",
  burma: "myanmar", palestine: "palestinian territories", "state of palestine": "palestinian territories", uae: "united arab emirates",
};
const norm = (c: string) => { const k = c.trim().toLowerCase(); return COUNTRY_ALIAS[k] ?? k; };

const SOUTH_AMERICA = new Set(["AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR", "UY", "VE"]);

export function continentOf(timezone: string | undefined, countryCode: string | undefined): string {
  const tz = (timezone ?? "").split("/")[0];
  if (tz === "America") return SOUTH_AMERICA.has(countryCode ?? "") ? "South America" : "North America";
  if (tz === "Europe" || tz === "Atlantic") return "Europe";
  if (tz === "Africa") return "Africa";
  if (tz === "Australia" || tz === "Pacific") return "Oceania";
  if (tz === "Antarctica") return "Antarctica";
  return "Asia";
}

/** Resolves a city+country to coordinates via Open-Meteo's free geocoder (no key). Returns null when no confident match. */
export async function geocode(fetchFn: Fetch, city: string, country: string): Promise<Place | null> {
  const res = await fetchFn(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const data = (await res.json()) as { results?: { latitude: number; longitude: number; country?: string; country_code?: string; timezone?: string; population?: number }[] };
  const want = norm(country);
  const hit = (data.results ?? []).filter((r) => r.country && norm(r.country) === want).sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
  return hit ? { lat: hit.latitude, lng: hit.longitude, continent: continentOf(hit.timezone, hit.country_code) } : null;
}
