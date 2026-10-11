import seed from "@shared/protests.seed.json";
import { LEANS, MAX_VOICE, XP_PER_BRIDGE, badgesFor, dayKey, isBlindspot, levelOf, maxStrength, nextStreak, sidesComplete, voteCost } from "@shared/rules.ts";
import type { Lean, Me, PipelineStatus, Protest, VoteKind } from "./types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const hasBackend = Boolean(API_URL);

export interface Api {
  mode: "live" | "offline";
  protests(): Promise<Protest[]>;
  status(): Promise<PipelineStatus | null>;
  me(): Promise<Me>;
  read(id: string, lean: Lean): Promise<Me>;
  vote(id: string, kind: VoteKind, direction: 1 | -1, strength: 1 | 2 | 3): Promise<{ me: Me; protest?: Protest }>;
}

function safeStorage() {
  try { localStorage.setItem("outcry.t", "1"); localStorage.removeItem("outcry.t"); return localStorage; } catch { return null; }
}
const storage = safeStorage();
const memory = new Map<string, string>();
const get = (k: string) => storage?.getItem(k) ?? memory.get(k) ?? null;
const set = (k: string, v: string) => { try { storage?.setItem(k, v); } catch { /* quota */ } memory.set(k, v); };

export function deviceId(): string {
  let id = get("outcry.device");
  if (!id) { id = crypto.randomUUID(); set("outcry.device", id); }
  return id;
}

// ---------- live (HTTP) ----------
function live(): Api {
  const call = async <T,>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "X-Device-Id": deviceId(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw Object.assign(new Error((await res.json().catch(() => ({}))).error ?? res.statusText), { status: res.status });
    return res.json();
  };
  return {
    mode: "live",
    protests: () => call("/api/protests"),
    status: () => call<PipelineStatus>("/api/status").catch(() => null),
    me: () => call("/api/me"),
    read: (id, lean) => call(`/api/protests/${id}/reads`, { lean }),
    vote: (id, kind, direction, strength) => call(`/api/protests/${id}/votes`, { kind, direction, strength }),
  };
}

// ---------- offline (localStorage) ----------
interface LocalState {
  xp: number; streak: number; lastBridge: string | null; spentDay: string; spent: number;
  votes: Me["votes"]; reads: Me["reads"];
}
const KEY = "outcry.local.v1";
const loadLocal = (): LocalState => {
  try { const raw = get(KEY); if (raw) return JSON.parse(raw); } catch { /* corrupt */ }
  return { xp: 0, streak: 0, lastBridge: null, spentDay: dayKey(), spent: 0, votes: {}, reads: {} };
};

function offline(): Api {
  const t0 = Date.now();
  const base: Protest[] = (seed as any[]).map((p) => ({
    id: p.id, title: p.title, summary: p.summary, city: p.city, country: p.country, continent: p.continent,
    lat: p.lat, lng: p.lng, startDate: new Date(t0 - p.daysAgo * 86_400_000).toISOString(), crowdEstimate: p.crowdEstimate,
    topic: p.topic, status: p.status, coverage: p.coverage, causeScore: p.causeScore, actionScore: p.actionScore,
    articles: p.articles.map((a: any) => ({ outlet: a.outlet, lean: a.lean, headline: a.headline, publishedAt: new Date(t0 - a.hoursAgo * 3_600_000).toISOString() })),
  }));
  const withVotes = (s: LocalState): Protest[] =>
    base.map((p) => ({ ...p, causeScore: p.causeScore + (s.votes[p.id]?.cause ?? 0), actionScore: p.actionScore + (s.votes[p.id]?.action ?? 0) }));
  const toMe = (s: LocalState): Me => {
    const spent = s.spentDay === dayKey() ? s.spent : 0;
    const fullyRead = Object.entries(s.reads).filter(([, l]) => sidesComplete(l, LEANS))
      .map(([id]) => base.find((p) => p.id === id)).filter((p): p is Protest => !!p)
      .map((p) => ({ continent: p.continent, blindspot: isBlindspot(p.coverage) }));
    return { credits: MAX_VOICE - spent, xp: s.xp, level: levelOf(s.xp), streak: s.streak, votes: s.votes, reads: s.reads, badges: badgesFor(fullyRead, s.streak) };
  };
  const save = (s: LocalState) => set(KEY, JSON.stringify(s));
  return {
    mode: "offline",
    protests: async () => withVotes(loadLocal()),
    status: async () => null,
    me: async () => toMe(loadLocal()),
    read: async (id, lean) => {
      const s = loadLocal();
      const have = s.reads[id] ?? [];
      if (LEANS.includes(lean) && !have.includes(lean)) {
        s.reads[id] = [...have, lean];
        if (sidesComplete(s.reads[id], LEANS)) {
          const today = dayKey();
          s.xp += XP_PER_BRIDGE; s.streak = nextStreak(s.streak, s.lastBridge, today); s.lastBridge = today;
        }
        save(s);
      }
      return toMe(s);
    },
    vote: async (id, kind, direction, strength) => {
      const s = loadLocal();
      const today = dayKey();
      if (s.spentDay !== today) { s.spentDay = today; s.spent = 0; }
      if (strength > maxStrength(s.reads[id] ?? [])) throw new Error("Read all perspectives to unlock stronger votes");
      if (voteCost(strength) > MAX_VOICE - s.spent) throw new Error("Not enough Voice left today");
      s.spent += voteCost(strength);
      const cur = s.votes[id] ?? { cause: 0, action: 0 };
      s.votes[id] = { ...cur, [kind]: cur[kind] + direction * strength };
      save(s);
      return { me: toMe(s), protest: withVotes(s).find((p) => p.id === id) };
    },
  };
}

/** Uses the backend when VITE_API_URL is set and reachable; otherwise runs fully offline in the browser. */
export async function connect(): Promise<Api> {
  if (hasBackend) {
    const api = live();
    try { await api.me(); return api; } catch { /* fall through to offline */ }
  }
  return offline();
}
