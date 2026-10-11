export const TOPICS = ["labor", "climate", "democracy", "rights", "economy", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export interface Classified { i: number; protest: boolean; city: string | null; country: string | null; topic: Topic }

/** Structural subset of Cloudflare's Workers AI binding. */
export interface AiLike { run(model: string, input: Record<string, unknown>): Promise<any> }
/** Tried in order; Cloudflare retires models, so a deprecated/unknown one falls through to the next. */
export const MODELS = ["@cf/meta/llama-3.1-8b-instruct-fp8", "@cf/meta/llama-3.2-3b-instruct", "@cf/mistralai/mistral-small-3.1-24b-instruct"];

async function runAi(ai: AiLike, input: Record<string, unknown>) {
  let lastErr: unknown;
  for (const model of MODELS) {
    try { return await ai.run(model, input); } catch (e) {
      lastErr = e;
      if (!/deprecat|not found|no such model|5028|5007/i.test(String(e))) throw e;
    }
  }
  throw lastErr;
}

const CLASSIFY_SYSTEM = `You label news headlines. For each numbered headline decide if it reports a SPECIFIC protest, strike, march, rally, vigil, walkout or civil demonstration happening now or very recently.
Answer protest=false for: military/air/missile strikes, wars, elections, sports, crime, court rulings, figurative uses of "protest", anniversaries, opinion pieces about protest in general, governments or diplomats "protesting" (diplomatic protests), or anything unclear.
For protests give: country (common English name of the country where it happens), city (the city or town; if nationwide or unspecified use the national capital), topic (one of labor, climate, democracy, rights, economy, other).
Respond with JSON only: {"items":[{"i":0,"protest":true,"city":"Paris","country":"France","topic":"labor"}]}. Include every headline.`;

/** Workers AI returns either a parsed object (JSON mode) or a string; accept both and salvage truncated JSON. */
export function parseAiJson(res: any): any {
  const raw = res?.response ?? res;
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  const obj = raw.indexOf("{"), arr = raw.indexOf("[");
  const start = arr >= 0 && (obj < 0 || arr < obj) ? arr : obj;
  if (start < 0) return null;
  const closer = raw[start] === "[" ? "]" : "}";
  const text = raw.slice(start);
  try { return JSON.parse(text.slice(0, text.lastIndexOf(closer) + 1)); } catch { /* maybe truncated */ }
  if (closer === "]") { // keep the complete objects of a cut-off array
    try { return JSON.parse(text.slice(0, text.lastIndexOf("}") + 1) + "]"); } catch { /* give up */ }
  }
  return null;
}

export async function classifyHeadlines(ai: AiLike, headlines: string[], onRaw?: (raw: unknown) => void): Promise<Classified[]> {
  const list = headlines.map((h, i) => `${i}. ${h}`).join("\n");
  const res = await runAi(ai, {
    messages: [{ role: "system", content: CLASSIFY_SYSTEM }, { role: "user", content: list }],
    max_tokens: 1800, temperature: 0,
  });
  const data = parseAiJson(res);
  const raw: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const out: Classified[] = raw.flatMap((x) => {
    const i = Number(x?.i ?? x?.index ?? x?.id);
    if (!Number.isInteger(i) || i < 0 || i >= headlines.length) return [];
    const clean = (v: unknown) => (typeof v === "string" && v.trim() && !/^(null|none|n\/a|unknown|unspecified|nationwide|national|various|multiple)$/i.test(v.trim()) ? v.trim().slice(0, 80) : null);
    return [{ i, protest: x.protest === true || x.protest === "true", city: clean(x.city), country: clean(x.country), topic: ((TOPICS as readonly string[]).includes(x.topic) ? x.topic : "other") as Topic }];
  });
  if (!out.length) onRaw?.(res);
  return out;
}

const SUMMARY_SYSTEM = `You write neutral wire-style copy about a protest using ONLY the headlines provided. Do not add facts, numbers, motives or names that are not in the headlines. No loaded adjectives.
Return JSON: {"title": "max 9 words describing what is happening or demanded", "summary": "one sentence under 30 words"}.`;

export async function summarizeCluster(ai: AiLike, place: string, headlines: string[]): Promise<{ title: string; summary: string } | null> {
  const res = await runAi(ai, {
    messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: `Place: ${place}\nHeadlines:\n${headlines.map((h) => `- ${h}`).join("\n")}` }],
    max_tokens: 200, temperature: 0.1,
  });
  const d = parseAiJson(res);
  if (typeof d?.title !== "string" || typeof d?.summary !== "string" || !d.title.trim()) return null;
  return { title: d.title.trim().replace(/\.$/, "").slice(0, 90), summary: d.summary.trim().slice(0, 240) };
}
