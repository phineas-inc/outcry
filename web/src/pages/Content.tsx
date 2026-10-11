import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Rich, useI18n } from "@/lib/i18n";

function DocPage({ name, cta }: { name: "privacy" | "accessibility"; cta?: boolean }) {
  const { page, t } = useI18n();
  const doc = page(name);
  useEffect(() => { document.title = `${doc.eyebrow} — Outcry`; }, [doc.eyebrow]);
  return (
    <main id="main" tabIndex={-1} className="page prose">
      <span className="eyebrow">{doc.eyebrow}</span>
      <h1 className="page-title">{doc.title}</h1>
      {doc.blocks.map((b, i) => (
        <section key={i}>
          {b.h && <h2>{b.h}</h2>}
          {b.p && <p><Rich text={b.p} /></p>}
        </section>
      ))}
      {cta && <p><Link className="cta" to="/app">{t("cta.open")}</Link></p>}
    </main>
  );
}

export const Privacy = () => <DocPage name="privacy" />;
export const Accessibility = () => <DocPage name="accessibility" />;
