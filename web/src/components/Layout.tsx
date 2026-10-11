import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { MAX_VOICE } from "@shared/rules.ts";
import Credit from "./Credit";
import Icon from "./Icon";

export default function Layout() {
  const { pathname, search } = useLocation();
  const [params, setParams] = useSearchParams();
  const { me, notice, flash, dismissNotice } = useStore();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const onFeed = pathname === "/feed" || pathname.startsWith("/feed/");
  const onMap = pathname === "/" || pathname.startsWith("/p/");
  const onExplore = onFeed || onMap;
  const isApp = onExplore || pathname === "/me";
  const q = new URLSearchParams(search).get("q");
  const keepQ = q ? `?q=${encodeURIComponent(q)}` : "";
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set("q", value) : next.delete("q");
    setParams(next, { replace: true });
  };

  // Move focus to the page on route change so keyboard and screen-reader users start at the new content.
  const first = useRef(true);
  const lastBase = useRef(pathname);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const detail = pathname.includes("/p/");
    const prevDetail = lastBase.current.includes("/p/");
    lastBase.current = pathname;
    if (detail || prevDetail) return; // the dialog manages its own focus
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  // Announce the Voice balance politely when it changes.
  const [announce, setAnnounce] = useState("");
  const lastCredits = useRef<number | null>(null);
  useEffect(() => {
    if (me == null) return;
    if (lastCredits.current !== null && lastCredits.current !== me.credits) setAnnounce(t("voice.announce", { n: me.credits, max: MAX_VOICE }));
    lastCredits.current = me.credits;
  }, [me, t]);

  return (
    <div className={`app ${isApp ? "is-app" : ""}`}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById("main"); m?.focus(); m?.scrollIntoView(); }}>{t("skip")}</a>
      <header className={`topbar ${onExplore ? "has-search" : ""}`}>
        <Link className="brand" to="/" aria-label={t("brand.home")}><span className="brand-mark">O</span><span>OUTCRY</span><i>{t("brand.tag")}</i></Link>
        <nav className="site-nav" aria-label={t("nav.site")}>
          <Link className={onMap ? "active" : ""} aria-current={onMap ? "page" : undefined} to={{ pathname: "/", search: keepQ }}>{t("nav.map")}</Link>
          <Link className={onFeed ? "active" : ""} aria-current={onFeed ? "page" : undefined} to={{ pathname: "/feed", search: keepQ }}>{t("nav.feed")}</Link>
          <NavLink to="/about">{t("nav.about")}</NavLink>
        </nav>
        {onExplore && <label className="search"><Icon name="search" /><input value={params.get("q") ?? ""} onChange={(e) => setQuery(e.target.value)} placeholder={t("search.ph")} aria-label={t("search.aria")} /></label>}
        <div className="tools">
          <button className="tool-btn" onClick={toggle} aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")} title={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
          <button className="tool-btn" onClick={() => setLang(lang === "en" ? "de" : "en")} lang={lang === "en" ? "de" : "en"} aria-label={t("lang.aria")} title={t("lang.aria")}>
            {lang === "en" ? "DE" : "EN"}
          </button>
        </div>
        <div className="voice" title={t("voice.title")}><span>{t("voice.label")}</span><strong>{me?.credits ?? "–"}</strong><i>{t("voice.today", { max: MAX_VOICE })}</i></div>
        <Link className="avatar" to="/me" aria-label={t("profile.open")}><Icon name="user" size={18} /></Link>
      </header>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
      {(notice || flash) && <div className={`toast ${notice ? "" : "info"}`} role={notice ? "alert" : "status"}><span>{notice ?? flash}</span>{notice && <button onClick={dismissNotice} aria-label={t("detail.close")}><Icon name="close" size={14} /></button>}</div>}
      <Outlet />
      <footer>
        {!isApp && (
          <div className="site-footer">
            <div><strong>OUTCRY</strong><span>{t("footer.tag")}</span></div>
            <nav aria-label={t("nav.footer")}><Link to="/about">{t("nav.about")}</Link><Link to="/privacy">{t("footer.privacy")}</Link><Link to="/accessibility">{t("footer.a11y")}</Link><a href="https://github.com/tahire29-spec/outcry" target="_blank" rel="noreferrer">{t("footer.open")}</a></nav>
          </div>
        )}
        <Credit />
      </footer>
      <nav className="tabbar" aria-label={t("nav.app")}>
        <Link className={onMap ? "on" : ""} aria-current={onMap ? "page" : undefined} to={{ pathname: "/", search: keepQ }}><Icon name="map" /><span>{t("tab.map")}</span></Link>
        <Link className={onFeed ? "on" : ""} aria-current={onFeed ? "page" : undefined} to={{ pathname: "/feed", search: keepQ }}><Icon name="list" /><span>{t("tab.feed")}</span></Link>
        <Link className={pathname === "/about" ? "on" : ""} aria-current={pathname === "/about" ? "page" : undefined} to="/about"><Icon name="info" /><span>{t("tab.about")}</span></Link>
        <Link className={pathname === "/me" ? "on" : ""} aria-current={pathname === "/me" ? "page" : undefined} to="/me"><Icon name="user" /><span>{t("tab.you")}</span></Link>
      </nav>
    </div>
  );
}
