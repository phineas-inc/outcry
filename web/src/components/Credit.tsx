import { useI18n } from "@/lib/i18n";

const links = [
  { href: "https://tanishqahire.com", label: "tanishqahire.com" },
  { href: "https://www.linkedin.com/in/tanishqahire/", label: "LinkedIn" },
  { href: "https://www.instagram.com/phineas.inc/", label: "Instagram @phineas.inc" },
];

export default function Credit() {
  const { t } = useI18n();
  return (
    <div className="credit">
      <span>{t("credit.with")} <span className="heart" role="img" aria-label={t("credit.love")}>♥</span> {t("credit.by")} <strong>Tanishq Ahire</strong></span>
      <nav aria-label={t("nav.creator")}>
        {links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}
      </nav>
    </div>
  );
}
