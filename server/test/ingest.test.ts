import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { openNodeDb } from "../src/db.ts";
import { runStage } from "../src/ingest/pipeline.ts";
import { parseFeed, isProtestHeadline } from "../src/ingest/sources.ts";
import { coverageOf, crowdFrom, statusOf, type ArticleRow } from "../src/ingest/cluster.ts";
import { leanOf } from "../src/ingest/outlets.ts";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toUTCString();
const rss = (items: [string, string, number][]) =>
  `<?xml version="1.0"?><rss><channel>${items.map(([t, l, h]) => `<item><title><![CDATA[${t}]]></title><link>${l}?utm_source=x</link><pubDate>${hoursAgo(h)}</pubDate></item>`).join("")}</channel></rss>`;

test("headline gate keeps protests and drops military strikes", () => {
  assert.ok(isProtestHeadline("Thousands march in Paris against pension reform"));
  assert.ok(isProtestHeadline("Rail workers strike over pay"));
  assert.ok(!isProtestHeadline("Israeli strikes hit Gaza overnight"));
  assert.ok(isProtestHeadline("Stocks rally as inflation cools")); // known false positive: the AI classifier is the second gate
  assert.ok(!isProtestHeadline("Local council approves budget"));
});

test("parses RSS, strips tracking params, decodes entities", () => {
  const items = parseFeed(rss([["Farmers &amp; unions protest", "https://www.bbc.com/news/1", 2]]), "x");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Farmers & unions protest");
  assert.equal(items[0].url, "https://www.bbc.com/news/1");
  assert.equal(items[0].domain, "bbc.com");
});

test("crowd extraction uses stated numbers only and ignores casualty headlines", () => {
  assert.equal(crowdFrom(["Some 40,000 protesters fill the square"]), 40000);
  assert.equal(crowdFrom(["Tens of thousands march in Madrid"]), null); // vague amounts are never converted to numbers
  assert.equal(crowdFrom(["India detains thousands of youth protesters"]), null);
  assert.equal(crowdFrom(["Police detain 5,000 protesters in Delhi"]), null);
  assert.equal(crowdFrom(["12 protesters killed as police open fire"]), null);
  assert.equal(crowdFrom(["Unions call a strike"]), null);
});

test("coverage counts distinct rated outlets; status reflects recency and volume", () => {
  const a = (domain: string, lean: any, h: number): ArticleRow => ({ url: `https://${domain}/${h}`, title: "t", domain, lean, published_at: new Date(NOW - h * 3_600_000).toISOString(), city: "c", country: "k", topic: "labor" });
  const cov = coverageOf([a("bbc.com", "Center", 1), a("bbc.com", "Center", 2), a("foxnews.com", "Right", 3), a("local.example", null, 4)]);
  assert.deepEqual(cov, { left: 0, center: 50, right: 50, rated: 2, sourceCount: 3 });
  assert.equal(statusOf([a("x.com", null, 60)], NOW), "winding down");
  assert.equal(statusOf([1, 2, 3, 4, 5].map((h) => a("x.com", null, h)), NOW), "escalating");
  assert.equal(leanOf("www.theguardian.com"), "Left");
  assert.equal(leanOf("unknown.example"), null);
});

test("collect → classify → build produces a live movement visible through the API", async () => {
  const db = openNodeDb(":memory:", { seed: false });
  const feeds: Record<string, string> = {
    "bbci.co.uk": rss([["Thousands protest pension reform in Paris", "https://www.bbc.com/news/p1", 3], ["Israeli strikes hit Gaza", "https://www.bbc.com/news/g1", 2]]),
    "theguardian.com": rss([["Rail workers strike in Paris over pensions", "https://www.theguardian.com/p2", 5]]),
    "foxnews.com": rss([["Paris protesters block roads as pension strike continues", "https://www.foxnews.com/p3", 1]]),
  };
  let geocodeCalls = 0;
  const fakeFetch = async (url: string) => {
    if (url.includes("geocoding-api")) { geocodeCalls++; return Response.json({ results: [{ latitude: 48.85, longitude: 2.35, country: "France", country_code: "FR", timezone: "Europe/Paris", population: 2e6 }] }); }
    if (url.includes("gdeltproject")) return new Response("rate limited", { status: 429 });
    const host = Object.keys(feeds).find((h) => url.includes(h));
    return host ? new Response(feeds[host]) : new Response("", { status: 404 });
  };
  const ai = {
    async run(_m: string, input: any) {
      const user: string = input.messages[1].content;
      if (user.startsWith("Place:")) return { response: { title: "Rail workers strike over pensions", summary: "Workers in Paris are striking over pension changes." } };
      const items = user.split("\n").map((l) => l.match(/^(\d+)\. (.*)$/)).filter(Boolean).map((m) => ({ i: Number(m![1]), protest: /paris/i.test(m![2]), city: "Paris", country: "France", topic: "labor" }));
      return { response: { items } };
    },
  };

  const out: any = await runStage("all", db, { fetch: fakeFetch as any, ai, now: NOW });
  assert.equal(out.collect.candidates, 3); // the Gaza strike headline is filtered out
  assert.equal(out.classify.protests, 3);
  assert.equal(out.build.written, 1);

  const app = createApp({ db });
  const list = await (await app.request("/api/protests")).json();
  assert.equal(list.length, 1);
  const p = list[0];
  assert.equal(p.city, "Paris");
  assert.equal(p.continent, "Europe");
  assert.equal(p.summaryAi, true);
  assert.deepEqual(p.coverage, { left: 33, center: 33, right: 33, rated: 3, sourceCount: 3 });
  assert.equal(p.articles.length, 3);
  assert.ok(p.articles.every((a: any) => a.url.startsWith("https://")));
  assert.equal(p.crowdEstimate, null); // no headline states a number

  // Re-running does not duplicate, re-geocode, or re-spend AI on unchanged clusters.
  const before = geocodeCalls;
  const again: any = await runStage("all", db, { fetch: fakeFetch as any, ai, now: NOW + 60_000 });
  assert.equal(again.classify.classified, 0);
  assert.equal(geocodeCalls, before);
  assert.equal((await (await app.request("/api/protests")).json()).length, 1);

  // Voting rule uses the sides that exist: reading all 3 available leans unlocks strength 3.
  const H = { "X-Device-Id": "ingest-device-0123456789", "Content-Type": "application/json" };
  const post = (path: string, body: unknown) => app.request(path, { method: "POST", headers: H, body: JSON.stringify(body) });
  assert.equal((await post(`/api/protests/${p.id}/votes`, { kind: "cause", direction: 1, strength: 3 })).status, 403);
  for (const lean of ["Left", "Center", "Right"]) await post(`/api/protests/${p.id}/reads`, { lean });
  assert.equal((await post(`/api/protests/${p.id}/votes`, { kind: "cause", direction: 1, strength: 3 })).status, 200);

  const status = await (await app.request("/api/status")).json();
  assert.equal(status.movements, 1);
  assert.ok(status.aiCallsToday >= 2);
});

test("admin ingest endpoint rejects missing or wrong tokens", async () => {
  process.env.INGEST_TOKEN = "secret-token-value";
  const app = createApp({ db: openNodeDb(":memory:", { seed: false }) });
  assert.equal((await app.request("/api/admin/ingest", { method: "POST" })).status, 401);
  assert.equal((await app.request("/api/admin/ingest", { method: "POST", headers: { Authorization: "Bearer wrong-token-value!" } })).status, 401);
  delete process.env.INGEST_TOKEN;
});

test("AI JSON parsing accepts objects, bare arrays, fenced text and truncated arrays", async () => {
  const { parseAiJson } = await import("../src/ingest/classify.ts");
  assert.deepEqual(parseAiJson({ response: { items: [1] } }), { items: [1] });
  assert.deepEqual(parseAiJson({ response: '```json\n{"items":[{"i":0}]}\n```' }), { items: [{ i: 0 }] });
  assert.deepEqual(parseAiJson({ response: '[{"i":0,"protest":false},{"i":1}]' }), [{ i: 0, protest: false }, { i: 1 }]);
  assert.deepEqual(parseAiJson({ response: '[{"i":0,"protest":false},{"i":1,"protest":true,"city":"Pa' }), [{ i: 0, protest: false }]);
  assert.equal(parseAiJson({ response: "sorry, I can't" }), null);
});

test("place clustering merges Delhi, New Delhi and nationwide-India articles but keeps other cities apart", async () => {
  const { clusterByPlace } = await import("../src/ingest/cluster.ts");
  const mk = (city: string, country: string, n: number): ArticleRow => ({ url: `https://x.example/${city}${n}`, title: "t", domain: `d${n}.example`, lean: null, published_at: new Date(NOW).toISOString(), city, country, topic: "rights" });
  const geo = (r: ArticleRow) => ({ Delhi: { lat: 28.65, lng: 77.23 }, "New Delhi": { lat: 28.61, lng: 77.21 }, India: { lat: 22, lng: 79 }, Mumbai: { lat: 19.07, lng: 72.88 } } as any)[r.city] && { ...({ Delhi: { lat: 28.65, lng: 77.23 }, "New Delhi": { lat: 28.61, lng: 77.21 }, India: { lat: 22, lng: 79 }, Mumbai: { lat: 19.07, lng: 72.88 } } as any)[r.city], continent: "Asia" };
  const out = clusterByPlace([mk("Delhi", "India", 1), mk("Delhi", "India", 2), mk("New Delhi", "India", 3), mk("India", "India", 4), mk("Mumbai", "India", 5)], geo);
  assert.equal(out.length, 2);
  const delhi = out.find((c) => c.city === "Delhi")!;
  assert.equal(delhi.articles.length, 4);
  assert.equal(out.find((c) => c.city === "Mumbai")!.articles.length, 1);
});
