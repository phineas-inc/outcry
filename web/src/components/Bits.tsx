import { dayNumber, fmt, signed } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { isBlindspot } from "@shared/rules.ts";
import type { Protest, Status } from "@/lib/types";
import Icon from "./Icon";

export const usePlace = () => {
  const { t } = useI18n();
  return (p: { city: string; country: string }) => (p.city === p.country ? t("place.nationwide", { country: p.country }) : `${p.city}, ${p.country}`);
};

export function BiasBar({ protest, compact = false }: { protest: Protest; compact?: boolean }) {
  const { t } = useI18n();
  const { left, center, right, sourceCount } = protest.coverage;
  const rated = protest.coverage.rated ?? sourceCount;
  const blindspot = left < 10 ? t("bias.leftBlind") : right < 10 ? t("bias.rightBlind") : null;
  if (rated < 3) return (
    <div className="bias"><div className="bias-head"><span>{sourceCount === 1 ? t("bias.limited1") : t("bias.limited", { n: sourceCount })}</span></div><div className="bias-bar compact limited" /></div>
  );
  return (
    <div className="bias">
      <div className="bias-head">
        <span>{t("bias.line", { l: left, c: center, r: right, n: sourceCount })}</span>
        {blindspot && isBlindspot({ ...protest.coverage, rated }) && <span className="blindspot">{blindspot}</span>}
      </div>
      <div className={`bias-bar ${compact ? "compact" : ""}`} role="img" aria-label={t("bias.aria", { l: left, c: center, r: right })}>
        <span className="bias-left" style={{ width: `${left}%` }} />
        <span className="bias-center" style={{ width: `${center}%` }} />
        <span className="bias-right" style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}

export const StatusChip = ({ status }: { status: Status }) => {
  const { t } = useI18n();
  return <span className={`status status-${status.replace(" ", "-")}`}><i />{t(`status.${status}` as "status.active")}</span>;
};

const Score = ({ label, value }: { label: string; value: number }) => (
  <div className="score"><span>{label}</span><strong>{signed(value)}</strong></div>
);

export function ProtestCard({ protest, onOpen }: { protest: Protest; onOpen: () => void }) {
  const { t } = useI18n();
  const place = usePlace();
  return (
    <button className="protest-card" onClick={onOpen}>
      <div className="card-main">
        <div className="card-kicker"><span>{place(protest)}</span><StatusChip status={protest.status} /></div>
        <h2 lang="en">{protest.title}</h2>
        <div className="facts"><span>{t("card.day", { n: dayNumber(protest.startDate) })}</span>{protest.crowdEstimate ? <span>{t("card.reported", { n: fmt.format(protest.crowdEstimate) })}</span> : <span>{t("card.articles", { n: protest.articleCount ?? protest.coverage.sourceCount })}</span>}<span className="topic">{t(`topic.${protest.topic}` as "topic.other")}</span></div>
        <BiasBar protest={protest} />
      </div>
      <div className="card-scores"><Score label={t("card.cause")} value={protest.causeScore} /><Score label={t("card.action")} value={protest.actionScore} /><span className="open-arrow"><Icon name="arrow" /></span></div>
    </button>
  );
}
