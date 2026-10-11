import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "@/lib/store";
import { MAX_VOICE } from "@shared/rules.ts";
import Credit from "./Credit";
import Icon from "./Icon";

export default function Layout() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const { me, notice, dismissNotice } = useStore();
  const isApp = pathname.startsWith("/app");
  const onExplore = pathname === "/app" || pathname.startsWith("/app/p/");
  const view = params.get("view") === "map" ? "map" : "list";
  const setQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className={`app ${isApp ? "is-app" : ""}`}>
      <header className={`topbar ${onExplore ? "has-search" : ""}`}>
        <Link className="brand" to="/" aria-label="Outcry home"><span className="brand-mark">O</span><span>OUTCRY</span><i>Live protest desk</i></Link>
        <nav className="site-nav" aria-label="Site">
          <NavLink to="/app">Explore</NavLink><NavLink to="/method">How it works</NavLink>
        </nav>
        {onExplore && <label className="search"><Icon name="search" /><input value={params.get("q") ?? ""} onChange={(e) => setQuery({ q: e.target.value })} placeholder="Search city, country, movement" aria-label="Search movements" /></label>}
        {onExplore && <div className="view-toggle" role="group" aria-label="View">
          <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setQuery({ view: "" })}><Icon name="list" /><span>List</span></button>
          <button className={view === "map" ? "active" : ""} aria-pressed={view === "map"} onClick={() => setQuery({ view: "map" })}><Icon name="map" /><span>Map</span></button>
        </div>}
        {isApp ? <>
          <div className="voice" title="Voice resets daily"><span>Voice</span><strong>{me?.credits ?? "–"}</strong><i>/ {MAX_VOICE} today</i></div>
          <Link className="avatar" to="/app/me" aria-label="Open profile"><Icon name="user" size={18} /></Link>
        </> : <Link className="cta-small" to="/app">Open the desk</Link>}
      </header>
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={dismissNotice} aria-label="Dismiss"><Icon name="close" size={14} /></button></div>}
      <Outlet />
      {!isApp && (
        <footer className="site-footer">
          <div><strong>OUTCRY</strong><span>See every side of every movement.</span></div>
          <nav aria-label="Footer"><Link to="/method">How it works</Link><Link to="/privacy">Privacy</Link><a href="https://github.com/tahire29-spec/outcry" target="_blank" rel="noreferrer">Open source</a></nav>
        </footer>
      )}
      <Credit />
      {isApp && (
        <nav className="tabbar" aria-label="App">
          <Link className={onExplore && view === "list" ? "on" : ""} to="/app"><Icon name="list" /><span>Feed</span></Link>
          <Link className={onExplore && view === "map" ? "on" : ""} to="/app?view=map"><Icon name="map" /><span>Map</span></Link>
          <Link className={pathname === "/app/me" ? "on" : ""} to="/app/me"><Icon name="user" /><span>You</span></Link>
        </nav>
      )}
    </div>
  );
}
