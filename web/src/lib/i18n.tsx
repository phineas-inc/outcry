import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { de, pagesDe } from "@/i18n/de";
import { en, pagesEn, type Key, type PageDoc } from "@/i18n/en";

export type Lang = "en" | "de";
const dicts: Record<Lang, Record<Key, string>> = { en, de };
const pages = { en: pagesEn, de: pagesDe };
const KEY = "outcry.lang";

const detect = (): Lang => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "de" || saved === "en") return saved;
  } catch { /* storage blocked */ }
  return (navigator.language ?? "en").toLowerCase().startsWith("de") ? "de" : "en";
};

// Mutable so plain formatting helpers (lib/format.ts) follow the active language; components re-render via context.
let locale: Lang = "en";
export const currentLocale = () => locale;

interface I18n {
  lang: Lang; setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  page: (name: keyof typeof pagesEn) => PageDoc;
}
const Ctx = createContext<I18n | null>(null);
export const useI18n = () => { const c = useContext(Ctx); if (!c) throw new Error("I18nProvider missing"); return c; };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => { const l = detect(); locale = l; return l; });
  useEffect(() => { locale = lang; document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    locale = l; setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<I18n>(() => ({
    lang, setLang,
    t: (key, vars) => (dicts[lang][key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? `{${k}}`)),
    page: (name) => pages[lang][name],
  }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tiny inline markup for page copy: **bold**, *italic*, [label](url) — internal paths become router links. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return <>{parts.map((p, i) => {
    let m;
    if ((m = p.match(/^\*\*([^*]+)\*\*$/))) return <b key={i}>{m[1]}</b>;
    if ((m = p.match(/^\*([^*]+)\*$/))) return <em key={i}>{m[1]}</em>;
    if ((m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/))) {
      return m[2].startsWith("/") ? <Link key={i} to={m[2]}>{m[1]}</Link> : <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  })}</>;
}
