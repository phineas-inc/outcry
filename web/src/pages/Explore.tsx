import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProtestCard } from "@/components/Bits";
import Detail from "@/components/Detail";
import Icon from "@/components/Icon";
import WorldMap from "@/components/WorldMap";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Protest, Status, Topic } from "@/lib/types";

type Sort = "trending" | "newest" | "largest" | "contested";
const topics: Topic[] = ["labor", "climate", "democracy", "rights", "economy", "other"];
const statuses: Status[] = ["active", "escalating", "winding down"];
const initial = { region: "all", topic: "all", size: "all", status: "all", lean: "all" };

export default function Explore() {
  const { protests, ready, mode, status } = useStore();
  const [params] = useSearchParams();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("trending");
  const [f, setF] = useState(initial);
  const q = (params.get("q") ?? "").toLowerCase();
  const view = params.get("view") === "map" ? "map" : "list";
  const selected = protests.find((p) => p.id === id) ?? null;
  const regions = useMemo(() => [...new Set(protests.map((p) => p.continent))].sort(), [protests]);

  useEffect(() => { document.title = selected ? `${selected.title} — Outcry` : "Explore movements — Outcry"; }, [selected]);

  const filtered = useMemo(() => {
    const out = protests.filter((p) => {
      const n = p.crowdEstimate ?? 0;
      const size = f.size === "all" || (f.size === "small" && p.crowdEstimate !== null && n < 10000) || (f.size === "medium" && n >= 10000 && n < 50000) || (f.size === "large" && n >= 50000);
      const c = p.coverage;
      const lean = f.lean === "all" || (f.lean === "balanced" && Math.max(c.left, c.center, c.right) < 50) || (f.lean === "blindspot" && (c.left < 10 || c.right < 10));
      return (!q || `${p.title} ${p.city} ${p.country}`.toLowerCase().includes(q)) && (f.region === "all" || p.continent === f.region)
        && (f.topic === "all" || p.topic === f.topic) && (f.status === "all" || p.status === f.status) && size && lean;
    });
    const by: Record<Sort, (a: Protest, b: Protest) => number> = {
      largest: (a, b) => (b.crowdEstimate ?? 0) - (a.crowdEstimate ?? 0),
      newest: (a, b) => +new Date(b.startDate) - +new Date(a.startDate),
      contested: (a, b) => Math.abs(a.causeScore - a.actionScore) - Math.abs(b.causeScore - b.actionScore),
      trending: (a, b) => b.coverage.sourceCount + (b.crowdEstimate ?? 0) / 1000 - (a.coverage.sourceCount + (a.crowdEstimate ?? 0) / 1000),
    };
    return [...out].sort(by[sort]);
  }, [protests, q, f, sort]);

  const open = (p: Protest) => navigate({ pathname: `/app/p/${p.id}`, search: params.toString() });
  const close = () => navigate({ pathname: "/app", search: params.toString() });
  const select = (key: keyof typeof initial, label: string, options: [string, string][]) => (
    <label><span>{label}</span>
      <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <Icon name="chevron" size={14} />
    </label>
  );

  return (
    <>
      <nav className="filters" aria-label="Protest filters">
        <span className="filter-label">Filter desk</span>
        {select("region", "Region", [["all", "Worldwide"], ...regions.map((r): [string, string] => [r, r])])}
        {select("topic", "Topic", [["all", "All topics"], ...topics.map((t): [string, string] => [t, t])])}
        {select("size", "Size", [["all", "Any size"], ["small", "Under 10K"], ["medium", "10K–50K"], ["large", "50K+"]])}
        {select("status", "Status", [["all", "Any status"], ...statuses.map((s): [string, string] => [s, s])])}
        {select("lean", "Coverage", [["all", "Any lean"], ["balanced", "Balanced"], ["blindspot", "Blindspots"]])}
        <span className="result-count">{filtered.length} movements</span>
      </nav>
      <main>
        {!ready ? <div className="loading" role="status">Loading the desk…</div> : view === "list" ? (
          <div className="list-view">
            <div className="page-heading">
              <div>
                <span className="eyebrow"><i className="live-dot" />{mode === "live" ? `Live · updated ${status?.lastBuild ? ago(status.lastBuild) : "soon"}` : "Sample data · Offline mode"}</span>
                <h1>Where the world is raising its voice.</h1>
                <p>Live movements, measured across the media spectrum.</p>
              </div>
              <label className="sort"><span>Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="trending">Trending</option><option value="newest">Newest</option><option value="largest">Largest</option><option value="contested">Most contested</option>
                </select><Icon name="chevron" size={14} />
              </label>
            </div>
            <div className="list-columns">
              <div className="column-labels"><span>Movement</span><span>Public signal</span></div>
              {filtered.map((p) => <ProtestCard key={p.id} protest={p} onOpen={() => open(p)} />)}
              {filtered.length === 0 && protests.length === 0 && <div className="empty"><strong>No movements yet.</strong><span>The newsroom bot checks for new protest coverage every hour.</span></div>}
              {filtered.length === 0 && protests.length > 0 && <div className="empty"><strong>No movements match these filters.</strong><button onClick={() => setF(initial)}>Clear filters</button></div>}
            </div>
          </div>
        ) : <WorldMap protests={filtered} onOpen={open} />}
      </main>
      {id && ready && (selected ? <Detail protest={selected} onClose={close} /> : (
        <div className="detail-wrap"><button className="scrim" onClick={close} aria-label="Close" /><aside className="detail-panel"><h2>Movement not found</h2><p className="summary">That link doesn't match a movement we track.</p><button className="icon-button" onClick={close} aria-label="Close"><Icon name="close" /></button></aside></div>
      ))}
    </>
  );
}
