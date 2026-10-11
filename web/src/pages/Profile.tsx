import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { LEVELS, MAX_VOICE } from "@shared/rules.ts";

export default function Profile() {
  const { me, ready, protests } = useStore();
  useEffect(() => { document.title = "Your profile — Outcry"; }, []);
  if (!ready || !me) return <main><div className="loading" role="status">Loading…</div></main>;
  const voted = Object.keys(me.votes);
  const bridged = Object.values(me.reads).filter((l) => l.length === 3).length;
  return (
    <main className="page narrow">
      <span className="eyebrow">Level {me.level + 1}</span>
      <h1 className="page-title">{LEVELS[me.level]}</h1>
      <div className="xp-block">
        <div className="xp-meta"><span>{me.xp % 100} / 100 XP</span><small>Read across perspectives to earn XP</small></div>
        <div className="xp-bar"><i style={{ width: `${me.xp % 100}%` }} /></div>
      </div>
      <div className="stat-grid">
        <div><strong>{me.streak}</strong><span>day Bridge streak</span></div>
        <div><strong>{me.credits}<small>/{MAX_VOICE}</small></strong><span>Voice left today</span></div>
        <div><strong>{bridged}</strong><span>stories read on all sides</span></div>
      </div>
      <h2 className="sub">Badges</h2>
      <div className="badges">{me.badges.map((b) => <span key={b.id} className={b.earned ? "" : "locked"}>{b.label}</span>)}</div>
      <h2 className="sub">Voting history</h2>
      {voted.length === 0 ? <p className="muted">No votes yet. <Link to="/app">Find a movement</Link> and make your voice count.</p> : (
        <ul className="history-list">
          {voted.map((id) => {
            const p = protests.find((x) => x.id === id); const v = me.votes[id];
            return p && <li key={id}><Link to={`/app/p/${id}`}><strong>{p.title}</strong><small>{p.city} · cause {v.cause > 0 ? "+" : ""}{v.cause} · action {v.action > 0 ? "+" : ""}{v.action}</small></Link></li>;
          })}
        </ul>
      )}
      <p className="muted small">Your progress is tied to this device. There are no accounts and no personal data. <Link to="/privacy">Privacy</Link></p>
    </main>
  );
}
