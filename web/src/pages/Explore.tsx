import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProtestCard } from "@/components/Bits";
import Detail from "@/components/Detail";
import Icon from "@/components/Icon";
import WorldMap from "@/components/WorldMap";
import { agoParts } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Protest, Status, Topic } from "@/lib/types";
import type { Key } from "@/i18n/en";

type Sort = "trending" | "newest" | "largest" | "contested";
const topics: Topic[] = ["labor", "climate", "democracy", "rights", "economy", "other"];
const statuses: Status[] = ["active", "escalating", "winding down"];
const initial = { region: "all", topic: "all", size: "all", status: "all", lean: "all" };

export default function Explore({ view }: { view: "map" | "list" }) {
  const { protests, ready, mode, status } = useStore();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { id } = useParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("trending");
  const [f, setF] = useState(initial);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Object.values(f).filter((v) => v !== "all").length;
  const q = (params.get("q") ?? "").toLowerCase();
  const selected = protests.find((p) => p.id === id) ?? null;
  const regions = useMemo(() => [...new Set(protests.map((p) => p.continent))].sort(), [protests]);

  useEffect(() => { document.title = `${selected ? selected.title : t("explore.title")} — Outcry`; }, [selected, t]);

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

  const base = view === "list" ? "/feed" : "";
  const open = (p: Protest) => navigate({ pathname: `${base}/p/${p.id}`, search: params.toString() });
  const close = () => navigate({ pathname: base || "/", search: params.toString() });
  const select = (key: keyof typeof initial, label: string, options: [string, string][]) => (
    <label><span>{label}</span>
      <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <Icon name="chevron" size={14} />
    </label>
  );
  const [agoKey, agoN] = status?.lastBuild ? agoParts(status.lastBuild) : [null, 0];

  return (
    <>
      <nav className={`filters ${filtersOpen ? "open" : ""}`} aria-label={t("filters.aria")}>
        <button className="filters-toggle" aria-expanded={filtersOpen} aria-controls="filter-fields" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name="list" size={16} /><span>{t("filters.toggle")}{activeFilters ? ` · ${t("filters.active", { n: activeFilters })}` : ""}</span>
          <span className="count" role="status">{t("filters.count", { n: filtered.length })}</span><Icon name="chevron" size={14} />
        </button>
        <div className="filter-fields" id="filter-fields">
        <span className="filter-label">{t("filters.desk")}</span>
        {select("region", t("filters.region"), [["all", t("filters.worldwide")], ...regions.map((r): [string, string] => [r, t(`continent.${r}` as Key)])])}
        {select("topic", t("filters.topic"), [["all", t("filters.allTopics")], ...topics.map((x): [string, string] => [x, t(`topic.${x}` as Key)])])}
        {select("size", t("filters.size"), [["all", t("filters.anySize")], ["small", t("filters.small")], ["medium", t("filters.medium")], ["large", t("filters.large")]])}
        {select("status", t("filters.status"), [["all", t("filters.anyStatus")], ...statuses.map((s): [string, string] => [s, t(`status.${s}` as Key)])])}
        {select("lean", t("filters.coverage"), [["all", t("filters.anyLean")], ["balanced", t("filters.balanced")], ["blindspot", t("filters.blindspots")]])}
        <span className="result-count">{t("filters.count", { n: filtered.length })}</span>
        </div>
      </nav>
      <main id="main" tabIndex={-1}>
        {!ready ? <div className="loading" role="status">{t("explore.loading")}</div> : view === "list" ? (
          <div className="list-view">
            <div className="page-heading">
              <div>
                <span className="eyebrow"><i className="live-dot" />{mode === "live" ? t("explore.live", { ago: agoKey ? t(agoKey, { n: agoN }) : t("explore.soon") }) : t("explore.offline")}</span>
                <h1>{t("explore.h1")}</h1>
                <p>{t("explore.sub")}</p>
              </div>
              <label className="sort"><span>{t("sort.by")}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {(["trending", "newest", "largest", "contested"] as Sort[]).map((s) => <option key={s} value={s}>{t(`sort.${s}` as Key)}</option>)}
                </select><Icon name="chevron" size={14} />
              </label>
            </div>
            <div className="list-columns">
              <div className="column-labels" aria-hidden="true"><span>{t("explore.col.movement")}</span><span>{t("explore.col.signal")}</span></div>
              {filtered.map((p) => <ProtestCard key={p.id} protest={p} onOpen={() => open(p)} />)}
              {filtered.length === 0 && protests.length === 0 && <div className="empty"><strong>{t("explore.none")}</strong><span>{t("explore.noneHint")}</span></div>}
              {filtered.length === 0 && protests.length > 0 && <div className="empty"><strong>{t("explore.noMatch")}</strong><button onClick={() => setF(initial)}>{t("filters.clear")}</button></div>}
            </div>
          </div>
        ) : <><h1 className="sr-only">{t("map.h1")}</h1><WorldMap protests={filtered} onOpen={open} /></>}
      </main>
      {id && ready && (selected ? <Detail protest={selected} onClose={close} /> : (
        <div className="detail-wrap" role="dialog" aria-modal="true" aria-labelledby="nf"><button className="scrim" onClick={close} aria-label={t("explore.closeAria")} /><aside className="detail-panel"><h2 id="nf">{t("explore.notFound")}</h2><p className="summary">{t("explore.notFoundHint")}</p><button className="icon-button" onClick={close} aria-label={t("explore.closeAria")}><Icon name="close" /></button></aside></div>
      ))}
    </>
  );
}
