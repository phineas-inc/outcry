import { useEffect, useId, useRef, useState } from "react";
import { agoParts, fmt, hoursAgo, signed } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { LEANS, maxStrength, requiredLeans, voteCost } from "@shared/rules.ts";
import type { Lean, Protest, VoteKind } from "@/lib/types";
import { BiasBar, StatusChip } from "./Bits";
import Icon from "./Icon";

function VoteControl({ label, score, kind, unlocked, credits, onCast }: {
  label: string; score: number; kind: VoteKind; unlocked: boolean; credits: number; onCast: (direction: 1 | -1, strength: 1 | 2 | 3) => void;
}) {
  const { t } = useI18n();
  const [hold, setHold] = useState<{ direction: number; strength: number; progress: number } | null>(null);
  const [picked, setPicked] = useState<1 | 2 | 3>(1);
  const frame = useRef<number | null>(null);
  const started = useRef(0);
  const direction = useRef<0 | 1 | -1>(0);
  const group = useId();
  const affordable = (s: number) => credits >= voteCost(s);
  const chosen = affordable(picked) ? picked : 1;
  const holdStrength = (elapsed: number): 1 | 2 | 3 => !unlocked ? 1 : elapsed >= 1500 && credits >= 9 ? 3 : elapsed >= 700 && credits >= 4 ? 2 : 1;

  const stop = () => {
    if (!direction.current) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    const elapsed = performance.now() - started.current;
    // A quick tap uses the strength chosen in the selector; a long press raises it by hold time.
    onCast(direction.current, elapsed < 450 ? (chosen as 1 | 2 | 3) : holdStrength(elapsed));
    direction.current = 0;
    setHold(null);
  };
  const start = (dir: 1 | -1) => {
    direction.current = dir;
    started.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started.current;
      setHold({ direction: dir, strength: holdStrength(elapsed), progress: Math.min(100, (elapsed / (unlocked ? 1500 : 400)) * 100) });
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
          <button key={dir} aria-label={t(`vote.${dir > 0 ? "support" : "oppose"}.${kind}` as "vote.support.cause")} className={`vote-button ${hold?.direction === dir ? "holding" : ""}`}
            onPointerDown={() => start(dir)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); onCast(dir, chosen as 1 | 2 | 3); } }}>
            {hold?.direction === dir && <svg className="hold-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" pathLength="100" style={{ strokeDashoffset: 100 - hold.progress }} /></svg>}
            <Icon name={dir > 0 ? "up" : "down"} size={20} />
          </button>
        ))}
      </div>
      {unlocked && (
        <fieldset className="strength">
          <legend>{t("vote.strength")}</legend>
          {([1, 2, 3] as const).map((s) => (
            <label key={s}>
              <input type="radio" name={`${group}-strength`} checked={chosen === s} disabled={!affordable(s)} onChange={() => setPicked(s)} aria-label={t("vote.strengthOpt", { s, c: voteCost(s) })} />
              <span aria-hidden="true">{s}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="hold-copy" aria-live="off">{hold ? t("vote.hold", { s: hold.strength, c: voteCost(hold.strength) }) : unlocked ? t("vote.holdMore") : t("vote.locked")}</div>
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export default function Detail({ protest, onClose }: { protest: Protest; onClose: () => void }) {
  const { me, readArticle, vote } = useStore();
  const { t } = useI18n();
  const reads = me?.reads[protest.id] ?? [];
  const available = LEANS.filter((l) => protest.articles.some((a) => a.lean === l));
  const unlocked = maxStrength(reads, available) > 1;
  const credits = me?.credits ?? 0;
  const closeRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Modal behaviour: focus moves in, Tab is trapped, the page behind is inert, and focus returns to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const wrap = wrapRef.current!;
    const siblings = [...(wrap.parentElement?.children ?? [])].filter((el) => el !== wrap) as HTMLElement[];
    siblings.forEach((el) => el.setAttribute("inert", ""));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = [...wrap.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      siblings.forEach((el) => el.removeAttribute("inert"));
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: protest.title, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* cancelled */ }
  };
  const [agoKey, agoN] = protest.updatedAt ? agoParts(protest.updatedAt) : [null, 0];

  return (
    <div className="detail-wrap" role="dialog" aria-modal="true" aria-labelledby="detail-title" ref={wrapRef}>
      <button className="scrim" aria-label={t("detail.closeBackdrop")} onClick={onClose} tabIndex={-1} />
      <aside className="detail-panel">
        <div className="detail-top">
          <span className="eyebrow">{t("detail.eyebrow")}</span>
          <div className="row-gap">
            <button className="icon-button" aria-label={t("detail.share")} onClick={share}><Icon name="external" /></button>
            <button ref={closeRef} className="icon-button" aria-label={t("detail.close")} onClick={onClose}><Icon name="close" /></button>
          </div>
        </div>
        <div className="detail-location">{protest.city === protest.country ? <>{protest.country} <span>/</span> {t("place.slash")}</> : <>{protest.city} <span>/</span> {protest.country}</>}</div>
        <h2 id="detail-title" lang="en">{protest.title}</h2>
        {protest.summary && <p className="summary" lang="en">{protest.summary}</p>}
        {protest.summaryAi && <p className="ai-note">{t("detail.ai")}{agoKey && ` ${t("detail.lastReport", { ago: t(agoKey, { n: agoN }) })}`}</p>}
        <div className="detail-meta"><StatusChip status={protest.status} /><span className="topic">{t(`topic.${protest.topic}` as "topic.other")}</span>{protest.crowdEstimate ? <span>{t("card.reported", { n: fmt.format(protest.crowdEstimate) })}</span> : <span>{t("detail.sizeUnknown")}</span>}</div>
        <BiasBar protest={protest} />
        <section className="vote-section" aria-labelledby="vote-h">
          <div className="section-heading">
            <div><span className="eyebrow">{t("vote.eyebrow")}</span><h3 id="vote-h">{t("vote.h")}</h3></div>
            <span className="credits-small">{t("voice.left", { n: credits })}</span>
          </div>
          <p className="explain">{t("vote.explain", { max: 10 })}</p>
          <div className="vote-grid">
            <VoteControl label={t("vote.cause")} kind="cause" score={protest.causeScore} unlocked={unlocked} credits={credits} onCast={(d, s) => vote(protest.id, "cause", d, s)} />
            <VoteControl label={t("vote.action")} kind="action" score={protest.actionScore} unlocked={unlocked} credits={credits} onCast={(d, s) => vote(protest.id, "action", d, s)} />
          </div>
          <div className={`read-unlock ${unlocked ? "unlocked" : ""}`}>
            <div className="read-dots" aria-hidden="true">{LEANS.map((l) => <span key={l} className={`${reads.includes(l) ? "read" : ""} ${available.includes(l) ? "" : "absent"}`}>{t(`lean.${l}` as "lean.Left")[0]}</span>)}</div>
            <p>{unlocked ? t("vote.unlocked") : requiredLeans(available).length < 2 ? t("vote.oneSided") : t("vote.readMore")}</p>
          </div>
        </section>
        <section className="coverage-section" aria-labelledby="ledger-h">
          <div className="section-heading"><div><span className="eyebrow">{t("ledger.eyebrow")}</span><h3 id="ledger-h">{t("ledger.h")}</h3></div></div>
          <div className="articles-grid">
            {LEANS.map((lean: Lean) => (
              <div className={`article-column lean-${lean.toLowerCase()}`} key={lean}>
                <div className="column-head"><span>{t(`lean.${lean}` as "lean.Left")}</span><b>{protest.coverage[lean.toLowerCase() as "left" | "center" | "right"]}%</b></div>
                {protest.articles.filter((a) => a.lean === lean).length === 0 && <div className="article none"><span>{t("ledger.none")}</span></div>}
                {protest.articles.filter((a) => a.lean === lean).map((a) => {
                  const body = <><span>{a.outlet} · {t("ledger.hours", { n: hoursAgo(a.publishedAt) })}{!a.url && ` · ${t("ledger.sample")}`}</span><strong>{a.headline}</strong><Icon name={a.url ? "external" : "arrow"} size={14} /></>;
                  return a.url
                    ? <a key={a.headline + a.outlet} href={a.url} target="_blank" rel="noreferrer" className="article" lang="en" onClick={() => readArticle(protest.id, lean)}>{body}</a>
                    : <button key={a.headline + a.outlet} className="article" lang="en" onClick={() => readArticle(protest.id, lean)}>{body}</button>;
                })}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
