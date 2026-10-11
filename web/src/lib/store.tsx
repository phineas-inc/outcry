import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { connect, type Api } from "./api";
import type { Lean, Me, Protest, VoteKind } from "./types";

interface Store {
  protests: Protest[]; me: Me | null; ready: boolean; mode: Api["mode"] | null; notice: string | null;
  readArticle: (id: string, lean: Lean) => void;
  vote: (id: string, kind: VoteKind, direction: 1 | -1, strength: 1 | 2 | 3) => Promise<void>;
  dismissNotice: () => void;
}
const Ctx = createContext<Store | null>(null);
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error("StoreProvider missing"); return s; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null);
  const [protests, setProtests] = useState<Protest[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await connect();
      const [ps, m] = await Promise.all([a.protests(), a.me()]);
      if (alive) { setApi(a); setProtests(ps); setMe(m); }
    })().catch(() => alive && setNotice("Couldn't load movements. Check your connection and reload."));
    return () => { alive = false; };
  }, []);

  const readArticle = useCallback((id: string, lean: Lean) => {
    api?.read(id, lean).then(setMe).catch(() => {});
  }, [api]);

  const vote = useCallback(async (id: string, kind: VoteKind, direction: 1 | -1, strength: 1 | 2 | 3) => {
    if (!api) return;
    try {
      const res = await api.vote(id, kind, direction, strength);
      setMe(res.me);
      if (res.protest) setProtests((cur) => cur.map((p) => (p.id === id ? res.protest! : p)));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Vote failed");
    }
  }, [api]);

  const value = useMemo<Store>(() => ({
    protests, me, ready: Boolean(api && me), mode: api?.mode ?? null, notice, readArticle, vote, dismissNotice: () => setNotice(null),
  }), [protests, me, api, notice, readArticle, vote]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
