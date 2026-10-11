import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BiasBar } from "@/components/Bits";
import { fmt } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function Landing() {
  const { protests, ready } = useStore();
  useEffect(() => { document.title = "Outcry — See every side of every movement"; }, []);
  const featured = [...protests].sort((a, b) => b.coverage.sourceCount - a.coverage.sourceCount).slice(0, 3);
  const countries = new Set(protests.map((p) => p.country)).size;
  const crowd = protests.reduce((a, p) => a + p.crowdEstimate, 0);
  return (
    <main className="landing">
      <section className="hero">
        <span className="eyebrow"><i className="live-dot" />Live protest desk</span>
        <h1>See every side of every movement.</h1>
        <p>Outcry tracks protests around the world, shows how the media spectrum covers them, and gives you a daily budget of Voice to weigh in, once you've read all sides.</p>
        <div className="hero-actions"><Link className="cta" to="/app">Open the desk</Link><Link className="cta ghost" to="/method">How it works</Link></div>
        <dl className="hero-stats">
          <div><dt>Movements</dt><dd>{ready ? protests.length : "–"}</dd></div>
          <div><dt>Countries</dt><dd>{ready ? countries : "–"}</dd></div>
          <div><dt>People on the streets</dt><dd>{ready ? fmt.format(crowd) : "–"}</dd></div>
        </dl>
      </section>
      <section className="steps">
        <div><b>01</b><h3>Track</h3><p>Browse a live list or world map of movements, filtered by region, topic, size and status.</p></div>
        <div><b>02</b><h3>Read the spectrum</h3><p>Every story shows its Left, Center and Right coverage, with blindspots flagged.</p></div>
        <div><b>03</b><h3>Make your voice count</h3><p>Vote on the cause and the action with quadratic Voice. Read all sides to unlock stronger votes.</p></div>
      </section>
      {featured.length > 0 && <section className="featured">
        <span className="eyebrow">Most covered right now (sample data)</span>
        {featured.map((p) => (
          <Link key={p.id} to={`/app/p/${p.id}`} className="feature-row">
            <div><small>{p.city}, {p.country}</small><h3>{p.title}</h3></div><BiasBar protest={p} compact />
          </Link>
        ))}
      </section>}
    </main>
  );
}
