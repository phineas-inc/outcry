import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { connect, type Api } from "./api";
import { useI18n } from "./i18n";
import type { Lean, Me, PipelineStatus, Protest, VoteKind } from "./types";

interface Store {
  protests: Protest[]; me: Me | null; status: PipelineStatus | null; ready: boolean; mode: Api["mode"] | null; notice: string | null; flash: string | null;
  readArticle: (id: string, lean: Lean) => void;
  vote: (id: string, kind: VoteKind, direction: 1 | -1, strength: 1 | 2 | 3) => Promise<void>;
  dismissNotice: () => void;
  eraseMyData: () => Promise<boolean>;
}
const Ctx = createContext<Store | null>(null);
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error("StoreProvider missing"); return s; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [api, setApi] = useState<Api | null>(null);
  const [protests, setProtests] = useState<Protest[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await connect();
      const [ps, m, st] = await Promise.all([a.protests(), a.me(), a.status()]);
      if (alive) { setApi(a); setProtests(ps); setMe(m); setStatus(st); }
    })().catch(() => alive && setLoadFailed(true));
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
      setNotice(null);
      setFlash(t("vote.recorded", { c: strength * strength }));
    } catch (e) {
      const status = (e as { status?: number }).status;
      setNotice(status === 402 ? t("err.noVoice") : status === 403 ? t("err.locked") : t("err.generic"));
    }
  }, [api, t]);

  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), 2600); return () => clearTimeout(id); }, [flash]);

  const eraseMyData = useCallback(async () => {
    if (!api) return false;
    try {
      await api.erase();
      const [ps, m] = await Promise.all([api.protests(), api.me()]);
      setProtests(ps); setMe(m);
      return true;
    } catch { setNotice(t("err.generic")); return false; }
  }, [api, t]);

  const value = useMemo<Store>(() => ({
    protests, me, status, ready: Boolean(api && me), mode: api?.mode ?? null, notice: notice ?? (loadFailed ? t("err.load") : null), flash,
    readArticle, vote, dismissNotice: () => { setNotice(null); setLoadFailed(false); }, eraseMyData,
  }), [protests, me, status, api, notice, flash, loadFailed, readArticle, vote, eraseMyData, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
