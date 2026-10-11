import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BiasBar, usePlace } from "@/components/Bits";
import { fmt } from "@/lib/format";
import { Rich, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export default function About() {
  const { protests, ready, status, mode } = useStore();
  const { t, page } = useI18n();
  const place = usePlace();
  const how = page("method");
  useEffect(() => { document.title = `${t("about.title")} — Outcry`; }, [t]);
  const featured = [...protests].sort((a, b) => b.coverage.sourceCount - a.coverage.sourceCount).slice(0, 3);
  const countries = new Set(protests.map((p) => p.country)).size;
  return (
    <main id="main" tabIndex={-1} className="landing">
      <section className="hero">
        <span className="eyebrow"><i className="live-dot" />{t("land.eyebrow")}</span>
        <h1>{t("land.h1")}</h1>
        <p>{t("land.p")}</p>
        <div className="hero-actions"><Link className="cta" to="/">{t("cta.open")}</Link><Link className="cta ghost" to="/feed">{t("cta.feed")}</Link></div>
        <dl className="hero-stats">
          <div><dt>{t("land.movements")}</dt><dd>{ready ? protests.length : "–"}</dd></div>
          <div><dt>{t("land.countries")}</dt><dd>{ready ? countries : "–"}</dd></div>
          <div><dt>{status ? t("land.articles") : t("land.outlets")}</dt><dd>{ready ? (status ? fmt.format(status.articlesTracked) : new Set(protests.flatMap((p) => p.articles.map((a) => a.outlet))).size) : "–"}</dd></div>
        </dl>
      </section>
      <section className="steps">
        <div><b>01</b><h2>{t("land.s1h")}</h2><p>{t("land.s1p")}</p></div>
        <div><b>02</b><h2>{t("land.s2h")}</h2><p>{t("land.s2p")}</p></div>
        <div><b>03</b><h2>{t("land.s3h")}</h2><p>{t("land.s3p")}</p></div>
      </section>
      <section className="how prose" aria-labelledby="how-h">
        <h2 id="how-h" className="how-title">{t("about.how")}</h2>
        {how.blocks.map((b, i) => (
          <div key={i}>
            {b.h && <h3>{b.h}</h3>}
            {b.p && <p><Rich text={b.p} /></p>}
          </div>
        ))}
      </section>
      {featured.length > 0 && <section className="featured" aria-labelledby="feat-h">
        <h2 id="feat-h" className="eyebrow">{mode === "live" ? t("land.featured") : t("land.featuredSample")}</h2>
        {featured.map((p) => (
          <Link key={p.id} to={`/p/${p.id}`} className="feature-row">
            <div><small>{place(p)}</small><h3 lang="en">{p.title}</h3></div><BiasBar protest={p} compact />
          </Link>
        ))}
      </section>}
    </main>
  );
}
