import { dayNumber, fmt, placeOf, signed } from "@/lib/format";
import { isBlindspot } from "@shared/rules.ts";
import type { Protest, Status } from "@/lib/types";
import Icon from "./Icon";

export function BiasBar({ protest, compact = false }: { protest: Protest; compact?: boolean }) {
  const { left, center, right, sourceCount } = protest.coverage;
  const blindspot = left < 10 ? "Left blindspot" : right < 10 ? "Right blindspot" : null;
  const rated = protest.coverage.rated ?? sourceCount;
  if (rated < 3) return (
    <div className="bias"><div className="bias-head"><span>{sourceCount} {sourceCount === 1 ? "source" : "sources"} · too few rated outlets to show a lean split</span></div><div className="bias-bar compact limited" /></div>
  );
  return (
    <div className="bias">
      <div className="bias-head">
        <span>L {left}% · C {center}% · R {right}% · {sourceCount} sources</span>
        {blindspot && isBlindspot({ ...protest.coverage, rated }) && <span className="blindspot">{blindspot}</span>}
      </div>
      <div className={`bias-bar ${compact ? "compact" : ""}`} role="img" aria-label={`Coverage: ${left}% left, ${center}% center, ${right}% right`}>
        <span className="bias-left" style={{ width: `${left}%` }} />
        <span className="bias-center" style={{ width: `${center}%` }} />
        <span className="bias-right" style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}

export const StatusChip = ({ status }: { status: Status }) => (
  <span className={`status status-${status.replace(" ", "-")}`}><i />{status}</span>
);

const Score = ({ label, value }: { label: string; value: number }) => (
  <div className="score"><span>{label}</span><strong>{signed(value)}</strong></div>
);

export function ProtestCard({ protest, onOpen }: { protest: Protest; onOpen: () => void }) {
  return (
    <button className="protest-card" onClick={onOpen}>
      <div className="card-main">
        <div className="card-kicker"><span>{placeOf(protest)}</span><StatusChip status={protest.status} /></div>
        <h2>{protest.title}</h2>
        <div className="facts"><span>Day {dayNumber(protest.startDate)}</span>{protest.crowdEstimate ? <span>{fmt.format(protest.crowdEstimate)} reported</span> : <span>{protest.articleCount ?? protest.coverage.sourceCount} articles</span>}<span className="topic">{protest.topic}</span></div>
        <BiasBar protest={protest} />
      </div>
      <div className="card-scores"><Score label="Cause" value={protest.causeScore} /><Score label="Action" value={protest.actionScore} /><span className="open-arrow"><Icon name="arrow" /></span></div>
    </button>
  );
}
