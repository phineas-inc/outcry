import { useEffect, useRef, useState } from "react";
import { ago, fmt, hoursAgo, placeOf, signed } from "@/lib/format";
import { useStore } from "@/lib/store";
import { LEANS, maxStrength, requiredLeans, voteCost } from "@shared/rules.ts";
import type { Lean, Protest, VoteKind } from "@/lib/types";
import { BiasBar, StatusChip } from "./Bits";
import Icon from "./Icon";

function VoteControl({ label, score, kind, unlocked, credits, onCast }: {
  label: string; score: number; kind: VoteKind; unlocked: boolean; credits: number; onCast: (direction: 1 | -1, strength: 1 | 2 | 3) => void;
}) {
  const [hold, setHold] = useState<{ direction: number; strength: number; progress: number } | null>(null);
  const frame = useRef<number | null>(null);
  const started = useRef(0);
  const direction = useRef<0 | 1 | -1>(0);
  const strengthAt = (elapsed: number): 1 | 2 | 3 =>
    !unlocked ? 1 : elapsed >= 1500 && credits >= 9 ? 3 : elapsed >= 700 && credits >= 4 ? 2 : 1;

  const stop = () => {
    if (!direction.current) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    onCast(direction.current, strengthAt(performance.now() - started.current));
    direction.current = 0;
    setHold(null);
  };
  const start = (dir: 1 | -1) => {
    direction.current = dir;
    started.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started.current;
      setHold({ direction: dir, strength: strengthAt(elapsed), progress: Math.min(100, (elapsed / (unlocked ? 1500 : 400)) * 100) });
      frame.current = requestAnimationFrame(tick);
    };
    tick();
  };
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  return (
    <div className="vote-control">
      <div className="vote-label"><span>{label}</span><strong>{signed(score)}</strong></div>
      <div className="vote-buttons">
        {([1, -1] as const).map((dir) => (
          <button key={dir} aria-label={`${dir > 0 ? "Support" : "Oppose"} ${kind}`} className={`vote-button ${hold?.direction === dir ? "holding" : ""}`}
            onPointerDown={() => start(dir)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); onCast(dir, 1); } }}>
            {hold?.direction === dir && <svg className="hold-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" pathLength="100" style={{ strokeDashoffset: 100 - hold.progress }} /></svg>}
            <Icon name={dir > 0 ? "up" : "down"} size={20} />
          </button>
        ))}
      </div>
      <div className="hold-copy">{hold ? `${hold.strength} Voice · cost ${voteCost(hold.strength)}` : unlocked ? "Hold for more Voice" : "Read all sides to unlock"}</div>
    </div>
  );
}

export default function Detail({ protest, onClose }: { protest: Protest; onClose: () => void }) {
  const { me, readArticle, vote } = useStore();
  const reads = me?.reads[protest.id] ?? [];
  const available = LEANS.filter((l) => protest.articles.some((a) => a.lean === l));
  const unlocked = maxStrength(reads, available) > 1;
  const credits = me?.credits ?? 0;
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: protest.title, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* cancelled */ }
  };

  return (
    <div className="detail-wrap" role="dialog" aria-modal="true" aria-label={protest.title}>
      <button className="scrim" aria-label="Close details" onClick={onClose} tabIndex={-1} />
      <aside className="detail-panel">
        <div className="detail-top">
          <span className="eyebrow">Live protest brief</span>
          <div className="row-gap">
            <button className="icon-button" aria-label="Share" onClick={share}><Icon name="external" /></button>
            <button ref={closeRef} className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
          </div>
        </div>
        <div className="detail-location">{protest.city === protest.country ? <>{protest.country} <span>/</span> nationwide</> : <>{protest.city} <span>/</span> {protest.country}</>}</div>
        <h2>{protest.title}</h2>
        {protest.summary && <p className="summary">{protest.summary}</p>}
        {protest.summaryAi && <p className="ai-note">AI-written from the headlines below. Check the sources.{protest.updatedAt && ` Last report ${ago(protest.updatedAt)}.`}</p>}
        <div className="detail-meta"><StatusChip status={protest.status} /><span className="topic">{protest.topic}</span>{protest.crowdEstimate ? <span>{fmt.format(protest.crowdEstimate)} reported</span> : <span>size not reported</span>}</div>
        <BiasBar protest={protest} />
        <section className="vote-section">
          <div className="section-heading">
            <div><span className="eyebrow">Make your voice count</span><h3>Two questions, two votes</h3></div>
            <span className="credits-small">{credits} Voice left</span>
          </div>
          <div className="vote-grid">
            <VoteControl label="Support the cause?" kind="cause" score={protest.causeScore} unlocked={unlocked} credits={credits} onCast={(d, s) => vote(protest.id, "cause", d, s)} />
            <VoteControl label="Support the action?" kind="action" score={protest.actionScore} unlocked={unlocked} credits={credits} onCast={(d, s) => vote(protest.id, "action", d, s)} />
          </div>
          <div className={`read-unlock ${unlocked ? "unlocked" : ""}`}>
            <div className="read-dots">{LEANS.map((l) => <span key={l} className={`${reads.includes(l) ? "read" : ""} ${available.includes(l) ? "" : "absent"}`}>{l[0]}</span>)}</div>
            <p>{unlocked ? "Spectrum unlocked — strength 3 available" : requiredLeans(available).length < 2 ? "Only one perspective has covered this so far, so stronger votes are locked." : "Open one article from each perspective to unlock stronger votes."}</p>
          </div>
        </section>
        <section className="coverage-section">
          <div className="section-heading"><div><span className="eyebrow">Source ledger</span><h3>Coverage across the spectrum</h3></div></div>
          <div className="articles-grid">
            {LEANS.map((lean: Lean) => (
              <div className={`article-column lean-${lean.toLowerCase()}`} key={lean}>
                <div className="column-head"><span>{lean}</span><b>{protest.coverage[lean.toLowerCase() as "left" | "center" | "right"]}%</b></div>
                {protest.articles.filter((a) => a.lean === lean).length === 0 && <div className="article none"><span>No coverage found</span></div>}
                {protest.articles.filter((a) => a.lean === lean).map((a) => {
                  const body = <><span>{a.outlet} · {hoursAgo(a.publishedAt)}h{!a.url && " · sample"}</span><strong>{a.headline}</strong><Icon name={a.url ? "external" : "arrow"} size={14} /></>;
                  return a.url
                    ? <a key={a.headline + a.outlet} href={a.url} target="_blank" rel="noreferrer" className="article" onClick={() => readArticle(protest.id, lean)}>{body}</a>
                    : <button key={a.headline + a.outlet} className="article" onClick={() => readArticle(protest.id, lean)}>{body}</button>;
                })}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
