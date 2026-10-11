import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { fmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Protest } from "@/lib/types";
import { usePlace } from "./Bits";
import Icon from "./Icon";

const W = 1000, H = 500, MAX_K = 12;
const projection = geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "Sphere" });
const landPath = (() => {
  const topo = world as unknown as Topology;
  return geoPath(projection)(feature(topo, topo.objects.countries as GeometryCollection)) ?? "";
})();
const spherePath = geoPath(projection)({ type: "Sphere" }) ?? "";

interface View { k: number; x: number; y: number }
interface Pt { p: Protest; x: number; y: number }

export default function WorldMap({ protests, onOpen }: { protests: Protest[]; onOpen: (p: Protest) => void }) {
  const { t } = useI18n();
  const place = usePlace();
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ p: Protest; left: number; top: number } | null>(null);
  const [sidebar, setSidebar] = useState(() => typeof window !== "undefined" && window.innerWidth > 720);
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);

  const points = useMemo<Pt[]>(() => protests.flatMap((p) => {
    const xy = projection([p.lng, p.lat]);
    return xy ? [{ p, x: xy[0], y: xy[1] }] : [];
  }), [protests]);

  const clusters = useMemo(() => {
    const radius = 34 / view.k;
    const out: { x: number; y: number; items: Pt[] }[] = [];
    for (const pt of points) {
      const c = out.find((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < radius);
      if (c) { c.items.push(pt); c.x = c.items.reduce((a, i) => a + i.x, 0) / c.items.length; c.y = c.items.reduce((a, i) => a + i.y, 0) / c.items.length; }
      else out.push({ x: pt.x, y: pt.y, items: [pt] });
    }
    return out;
  }, [points, view.k]);

  const clamp = (v: View): View => {
    const k = Math.min(MAX_K, Math.max(1, v.k));
    return { k, x: Math.min(120, Math.max(W * (1 - k) - 120, v.x)), y: Math.min(80, Math.max(H * (1 - k) - 80, v.y)) };
  };
  const zoomAt = (factor: number, cx = W / 2, cy = H / 2) => setView((v) => {
    const k = Math.min(MAX_K, Math.max(1, v.k * factor));
    return clamp({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k });
  });
  const toUnits = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H); // preserveAspectRatio "meet"
    return [(clientX - r.left - (r.width - W * s) / 2) / s, (clientY - r.top - (r.height - H * s) / 2) / s];
  };

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [cx, cy] = toUnits(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) { d.moved = true; svg.current?.setPointerCapture(e.pointerId); setHover(null); }
    const r = svg.current!.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    setView((v) => clamp({ ...v, x: d.vx + dx / s, y: d.vy + dy / s }));
  };
  const onPointerUp = () => { setTimeout(() => (drag.current = null), 0); };
  const guard = (fn: () => void) => () => { if (!drag.current?.moved) fn(); };

  const showTip = (p: Protest, el: Element) => {
    const s = stage.current!.getBoundingClientRect(), r = el.getBoundingClientRect();
    setHover({ p, left: Math.min(s.width - 250, r.left - s.left + r.width + 8), top: Math.max(8, Math.min(s.height - 110, r.top - s.top - 30)) });
  };
  const zoomInto = (x: number, y: number) => setView((v) => {
    const k = Math.min(MAX_K, v.k * 2.4);
    return clamp({ k, x: W / 2 - x * k, y: H / 2 - y * k });
  });

  const inv = 1 / view.k;
  return (
    <div className="map-shell">
      <div className="map-stage" ref={stage}>
        <svg ref={svg} className="world-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={t("map.aria")}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <path d={spherePath} className="map-sphere" />
            <path d={landPath} className="map-land" style={{ strokeWidth: 0.6 * inv }} />
            {clusters.map((c) => c.items.length > 1 ? (
              <g key={c.items.map((i) => i.p.id).join()} className="cluster-g" transform={`translate(${c.x} ${c.y}) scale(${inv})`} tabIndex={0} role="button"
                aria-label={t("map.cluster", { n: c.items.length })} onClick={guard(() => zoomInto(c.x, c.y))}
                onKeyDown={(e) => e.key === "Enter" && zoomInto(c.x, c.y)}>
                <circle r="17" /><text textAnchor="middle" dy="6">{c.items.length}</text>
              </g>
            ) : (() => {
              const { p } = c.items[0];
              const r = Math.max(5, Math.min(13, 4 + Math.sqrt(p.crowdEstimate ?? 2000) / 40));
              return (
                <g key={p.id} className={`marker-g ${p.status.replace(" ", "-")}`} transform={`translate(${c.x} ${c.y}) scale(${inv})`} tabIndex={0} role="button"
                  aria-label={`${p.title}, ${p.city}`} onClick={guard(() => onOpen(p))} onKeyDown={(e) => e.key === "Enter" && onOpen(p)}
                  onMouseEnter={(e) => showTip(p, e.currentTarget)} onMouseLeave={() => setHover(null)} onFocus={(e) => showTip(p, e.currentTarget)} onBlur={() => setHover(null)}>
                  <circle className="pulse" r={r} /><circle className="dot" r={r} /><circle className="core" r={r * 0.35} />
                </g>
              );
            })())}
          </g>
        </svg>
        {hover && <div className="map-tooltip" style={{ left: hover.left, top: hover.top }}><span>{place(hover.p)}</span><strong lang="en">{hover.p.title}</strong><small>{hover.p.crowdEstimate ? `${fmt.format(hover.p.crowdEstimate)} · ` : ""}{t(`status.${hover.p.status}` as "status.active")}</small></div>}
        <div className="map-caption"><span className="live-dot" />{t("map.tracking", { n: protests.length })}</div>
        <div className="map-controls">
          <button onClick={() => zoomAt(1.6)} aria-label={t("map.zoomIn")}><Icon name="plus" /></button>
          <button onClick={() => zoomAt(1 / 1.6)} aria-label={t("map.zoomOut")}><Icon name="minus" /></button>
        </div>
      </div>
      <aside className={`map-sidebar ${sidebar ? "" : "collapsed"}`}>
        <button className="sidebar-toggle" onClick={() => setSidebar(!sidebar)} aria-label={t("map.toggle")} aria-expanded={sidebar}><Icon name={sidebar ? "arrow" : "list"} /></button>
        {sidebar && <>
          <div className="map-sidebar-head"><span className="eyebrow">{t("map.inArea")}</span><strong>{t("filters.count", { n: protests.length })}</strong></div>
          <div className="map-list">{protests.map((p) => (
            <button key={p.id} onClick={() => onOpen(p)}>
              <span className={`map-list-dot ${p.status.replace(" ", "-")}`} />
              <span><strong lang="en">{p.title}</strong><small>{p.city === p.country ? t("place.nationwideShort") : p.city}{p.crowdEstimate ? ` · ${fmt.format(p.crowdEstimate)}` : ""}</small></span>
              <Icon name="arrow" size={14} />
            </button>
          ))}</div>
        </>}
      </aside>
    </div>
  );
}
