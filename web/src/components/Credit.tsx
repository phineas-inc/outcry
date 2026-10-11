const links = [
  { href: "https://tanishqahire.com", label: "tanishqahire.com" },
  { href: "https://www.linkedin.com/in/tanishqahire/", label: "LinkedIn" },
  { href: "https://www.instagram.com/phineas.inc/", label: "Instagram @phineas.inc" },
];

export default function Credit() {
  return (
    <div className="credit">
      <span>Created with <span className="heart" role="img" aria-label="love">♥</span> by <strong>Tanishq Ahire</strong></span>
      <nav aria-label="Creator links">
        {links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>)}
      </nav>
    </div>
  );
}
