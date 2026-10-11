import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { MAX_VOICE } from "@shared/rules.ts";
import type { Key } from "@/i18n/en";

export default function Profile() {
  const { me, ready, protests, eraseMyData } = useStore();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { document.title = `${t("me.title")} — Outcry`; }, [t]);
  if (!ready || !me) return <main id="main" tabIndex={-1}><div className="loading" role="status">…</div></main>;
  const voted = Object.keys(me.votes);
  const bridged = Object.entries(me.reads).filter(([, l]) => l.length >= 2).length;

  const download = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), progress: me }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "outcry-my-data.json"; a.click();
    URL.revokeObjectURL(a.href);
  };
  const erase = async () => { if (await eraseMyData()) { setDone(true); setConfirming(false); } };

  return (
    <main id="main" tabIndex={-1} className="page narrow">
      <span className="eyebrow">{t("me.level", { n: me.level + 1 })}</span>
      <h1 className="page-title">{t(`level.${me.level}` as Key)}</h1>
      <div className="xp-block">
        <div className="xp-meta"><span>{t("me.xp", { n: me.xp % 100 })}</span><small>{t("me.xpHint")}</small></div>
        <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={me.xp % 100} aria-label={t("me.xp", { n: me.xp % 100 })}><i style={{ width: `${me.xp % 100}%` }} /></div>
      </div>
      <div className="stat-grid">
        <div><strong>{me.streak}</strong><span>{t("me.streak")}</span></div>
        <div><strong>{me.credits}<small>/{MAX_VOICE}</small></strong><span>{t("me.voiceLeft")}</span></div>
        <div><strong>{bridged}</strong><span>{t("me.bridged")}</span></div>
      </div>
      <h2 className="sub">{t("me.badges")}</h2>
      <div className="badges">{me.badges.map((b) => <span key={b.id} className={b.earned ? "" : "locked"}>{t(`badge.${b.id}` as Key)}</span>)}</div>
      <h2 className="sub">{t("me.history")}</h2>
      {voted.length === 0 ? <p className="muted">{t("me.noVotes")} <Link to="/app">{t("me.find")}</Link> {t("me.noVotes2")}</p> : (
        <ul className="history-list">
          {voted.map((id) => {
            const p = protests.find((x) => x.id === id); const v = me.votes[id];
            return p && <li key={id}><Link className="history-link" to={`/app/p/${id}`}><strong lang="en">{p.title}</strong><small>{p.city} · {t("me.cause")} {v.cause > 0 ? "+" : ""}{v.cause} · {t("me.action")} {v.action > 0 ? "+" : ""}{v.action}</small></Link></li>;
          })}
        </ul>
      )}
      <h2 className="sub">{t("me.data")}</h2>
      <p className="muted">{t("me.note")} <Link to="/privacy">{t("footer.privacy")}</Link></p>
      <div className="danger-zone">
        <button className="btn" onClick={download}>{t("me.download")}</button>
        {!confirming && <button className="btn danger" onClick={() => { setConfirming(true); setDone(false); }}>{t("me.delete")}</button>}
      </div>
      {confirming && (
        <div className="danger-zone" role="alertdialog" aria-label={t("me.delete")}>
          <p className="muted">{t("me.deleteConfirm")}</p>
          <button className="btn danger" onClick={erase}>{t("me.deleteYes")}</button>
          <button className="btn" onClick={() => setConfirming(false)}>{t("me.cancel")}</button>
        </div>
      )}
      {done && <p className="muted" role="status">{t("me.deleted")}</p>}
    </main>
  );
}
