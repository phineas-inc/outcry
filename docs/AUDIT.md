# Outcry — accessibility, UX and EU compliance audit

Audited 11 Oct 2026 against the live site and a local build. Tools: axe-core 4.10 (WCAG 2.0/2.1/2.2 A+AA + best-practice rules), manual keyboard tests, computed contrast ratios, viewport tests at 320 px and desktop.
**This is an expert and automated review, not a certification and not legal advice.** Automated tools find only part of real-world barriers.

## 1. Accessibility (WCAG 2.1 AA / EN 301 549)

### Found on the first pass, and fixed

| # | Finding | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | Dim/secondary text `#696c68` on `#0d0e0e` = 3.4–3.6:1 on 22 elements per page | 1.4.3 | Serious | Tokens re-chosen: every text/background pair ≥ 4.5:1 in both themes (checked numerically) |
| 2 | ~60 text nodes at 7–10 px | 1.4.4 / best practice | Serious | Floor raised: nothing below 11 px, most labels 12 px |
| 3 | Links inside text had 1.29:1 contrast against surrounding text | 1.4.1 | Serious | Text links underlined |
| 4 | Vote strengths 2 and 3 only reachable by pointer long-press | 2.1.1 | Serious | Strength selector (radio group) + keyboard activation; hold still works |
| 5 | Detail dialog: Tab escaped to the page behind, focus not restored | 2.4.3, 4.1.2 | Major | Focus trap, `inert` background, focus returns to the trigger, Esc closes |
| 6 | No skip link | 2.4.1 | Major | Skip link; focus moves to `<main>` on route change |
| 7 | Footer credit outside any landmark; map view without `<h1>`; heading jump h1→h3 on landing | 1.3.1 / 2.4.6 | Moderate | Single `<footer>` landmark; hidden `<h1>` on map; h2 headings |
| 8 | Touch targets 18–38 px (search, vote buttons, credit links, avatar) | 2.5.5 (AAA) / 2.5.8 | Moderate | 44 px (40 px on phones for header tools); credit links padded |
| 9 | Voice balance changes and vote results not announced | 4.1.3 | Moderate | Polite live region and a status toast |
| 10 | English movement text inside German UI not marked | 3.1.2 | Minor | `lang="en"` on titles, summaries, headlines |

### Verified after fixes
- axe-core: **0 violations** on landing, explore list, map, detail dialog, profile, how-it-works, privacy — in dark/English and light/German.
- Keyboard: Tab wraps both ways inside the dialog; vote strength 2 cast by keyboard only; result announced.
- Reflow: no horizontal scrolling at 320 px in German (the longest language).
- `prefers-reduced-motion` honoured; `prefers-color-scheme` followed until the user chooses.

### Not verified / open
- **No screen-reader testing** (VoiceOver, NVDA, TalkBack) and no testing with disabled users. This matters most.
- The **map** is visual; marker/cluster buttons are keyboard-focusable and labelled, but the list view is the accessible equivalent.
- Contrast was computed for the design tokens and axe-checked on rendered pages, not on every state (hover, disabled, hold ring).
- Text-spacing override (1.4.12) and 200 % zoom were not separately tested.

## 2. UX principles (Nielsen heuristics, plus Hick's / Fitts's / Miller's laws)

| Heuristic | Observation | Status |
|---|---|---|
| Visibility of system status | "Updated N ago" shows the last build; vote result gave only a score change | Fixed: confirmation toast + announcement. "Live"/"Offline" labelled |
| Match with the real world | "Voice", "Cause vs Action", "Bridge streak" are jargon with no first-use explanation | Partly fixed: one-line Voice explainer in the vote panel. Streak/XP still explained only on *How it works* |
| User control & freedom | Votes are irreversible within the day | **Open** — no undo; consider a short undo window |
| Consistency | Terms consistent across list, map, dialog | OK |
| Error prevention | Locked strengths are disabled and say why; unaffordable strengths disabled | Fixed |
| Recognition over recall | Hold-to-boost vote was undiscoverable | Fixed: visible strength selector + hint |
| Flexibility | Filters reset on reload and are not in the URL | **Open** |
| Aesthetic / minimalist | Five filters + sort + view toggle on first load (Hick's law) | **Open** — consider collapsing filters on phones |
| Help & documentation | *How it works* page, linked from header/footer | OK |
| Recover from errors | API failure silently falls back to sample data, labelled "Offline mode" | OK but could offer retry |
| Fitts's law | Small targets | Fixed (see A11y #8) |
| Miller's law | Detail panel is long (vote, coverage, 9 articles) | **Open** |

## 3. EU requirements

| Area | Finding | Status |
|---|---|---|
| **European Accessibility Act / EN 301 549** | Applies to many consumer services since 28 Jun 2025; a micro-enterprise exemption exists for services, and a non-commercial hobby project may fall outside scope — but WCAG 2.1 AA is the right target either way | Accessibility statement page added (EN/DE) |
| **GDPR — transparency (Art. 13)** | Privacy page named no controller and no contact | Fixed: controller and contact added (**add an email**, see below) |
| **GDPR — access/portability/erasure (Art. 15, 17, 20)** | Erasure required a GitHub issue | Fixed: **Download my data** and **Delete my data** on the profile, backed by `DELETE /api/me` (tested) |
| **GDPR — lawful basis & minimisation** | Random device UUID is an online identifier (personal data). Basis documented as legitimate interest; no names, emails, locations | Documented |
| **ePrivacy (Art. 5(3)) / cookies** | No cookies. A device ID, theme and language are kept in localStorage; the ID is needed for the voting budget the user asked for (strictly-necessary reading), theme/language are user preferences. **No consent banner is shown** — this is a defensible but not risk-free reading | Open: have it confirmed if the site grows |
| **Third parties / transfers** | Fonts self-hosted (no Google Fonts leak). GitHub Pages and Cloudflare process IP addresses (US companies, covered by their EU–US data-privacy framework participation) | Disclosed in the privacy page |
| **German Impressum (DDG §5)** | A public German-language site run by an identifiable person normally needs provider identification (name, postal address, email). Purely personal/family use is exempt; a public project may not be | **Open — needs your decision and your postal address; I did not invent one** |
| **Language** | German and English; AI-written movement text is English only and labelled | Done |

## 4. SUS (System Usability Scale)

**There is no SUS score yet, and I did not make one up.** SUS is a questionnaire answered by real users after they use the product; it cannot be computed by reviewing the code. See [SUS.md](SUS.md) for the ready-to-use questionnaire (EN/DE), scoring, and a test plan. Aim for 5–8 participants; a score ≥ 68 is average, ≥ 80 good.
