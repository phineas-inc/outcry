import { FEED_GROUPS } from "./outlets.ts";

export interface Candidate { url: string; title: string; domain: string; publishedAt: string }
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Headlines worth sending to the classifier: cheap regex gate that drops most unrelated news. */
export const PROTEST_RE = /\b(protest\w*|demonstrat\w*|rall(?:y|ies|ied)|march(?:es|ed|ers)?|strikes?|striking|strikers?|walkouts?|vigils?|unrest|riots?|rioters?|sit-ins?|picket\w*|blockad\w+|occupy\w*|uprising|mass\s+mobili[sz]ation|general\s+strike|hunger\s+strike|take\s+to\s+the\s+streets)\b/i;
// Military / non-civil uses that match the regex but are never protests.
const NOISE_RE = /\b(air\s?strikes?|missile\s+strikes?|drone\s+strikes?|military\s+strikes?|strikes?\s+(?:on|against|in)\s+(?:gaza|iran|ukraine|yemen|lebanon|syria|russia)|israeli\s+strikes?|russian\s+strikes?|lightning\s+strike|strike\s+rate|ground\s+strike)\b/i;

export const isProtestHeadline = (t: string) => PROTEST_RE.test(t) && !NOISE_RE.test(t);

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|cmp|ocid|fbclid|gclid|ito$|xtor)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch { return null; }
}

export const domainOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

const field = (block: string, tag: string) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
};

/** Parses RSS 2.0 / RDF items and Atom entries; tolerant, regex-based (no DOM in Workers). */
export function parseFeed(xml: string, feedUrl: string): Candidate[] {
  const out: Candidate[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const b of blocks.slice(0, 80)) {
    const title = decode(field(b, "title"));
    let link = decode(field(b, "link"));
    if (!link) link = b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? decode(field(b, "guid"));
    const url = normalizeUrl(link);
    if (!title || !url) continue;
    const date = Date.parse(decode(field(b, "pubDate") || field(b, "dc:date") || field(b, "published") || field(b, "updated")));
    out.push({ url, title, domain: domainOf(url), publishedAt: new Date(Number.isNaN(date) ? Date.now() : date).toISOString() });
  }
  void feedUrl;
  return out;
}

export async function fetchFeeds(fetchFn: Fetch, feeds: string[] = FEED_GROUPS[0]): Promise<{ items: Candidate[]; failed: string[] }> {
  const failed: string[] = [];
  const results = await Promise.allSettled(feeds.map(async (f) => {
    const res = await fetchFn(f, { headers: { "User-Agent": "outcry-bot/1.0 (+https://github.com/tahire29-spec/outcry)", Accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    return parseFeed(await res.text(), f);
  }));
  const items: Candidate[] = [];
  results.forEach((r, i) => (r.status === "fulfilled" ? items.push(...r.value) : failed.push(feeds[i])));
  return { items, failed };
}

/** GDELT DOC 2.0 article list. Best effort: it rate-limits aggressively (1 req / 5 s), so failure is normal. */
export async function fetchGdelt(fetchFn: Fetch): Promise<{ items: Candidate[]; status: number | string }> {
  const q = encodeURIComponent("(protest OR protesters OR demonstrators OR walkout OR \"general strike\") sourcelang:english");
  try {
    const res = await fetchFn(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=120&timespan=12h&sort=datedesc`, { headers: { "User-Agent": "outcry-bot/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { items: [], status: res.status };
    const data = (await res.json()) as { articles?: { url: string; title: string; seendate: string }[] };
    const items = (data.articles ?? []).flatMap((a) => {
      const url = normalizeUrl(a.url);
      const m = a.seendate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      if (!url || !a.title) return [];
      return [{ url, title: decode(a.title), domain: domainOf(url), publishedAt: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date().toISOString() }];
    });
    return { items, status: res.status };
  } catch (e) { return { items: [], status: String(e).slice(0, 60) }; }
}
