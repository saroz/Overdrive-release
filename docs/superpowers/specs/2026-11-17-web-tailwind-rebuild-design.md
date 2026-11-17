# Web UI rebuild on Tailwind — design

Date: 2026-11-17 · Branch: `feat/web-theme-redesign` · Follows: `2026-11-16-web-theme-redesign-design.md`

## Why

The first pass changed colours, the browser shell and the home page structure, but every page still renders
through the old markup (`dash-*`, cards, settings rows) and ~6,000 lines of old CSS (`styles.css`, `revamp.css`)
plus per-page inline `<style>` blocks. The result has the new palette and the old look.

User (verbatim): "YourDrive-theme-preview.html is the cleanes visually well maintained" … "I want to make visually
simmilar with taht one, every style, aslo a width of sidebar make it little larger, and also try different icons".

## Source of truth

`docs/superpowers/specs/2026-11-16-web-theme-mockup.html` (copy of the user's Desktop `YourDrive-theme-preview.html`).
Every colour, radius, size, spacing, weight and breakpoint comes from its `<style>` block, including the
"Usability refinement" overrides at the end, which win over the earlier rules.

## Decisions

| # | Decision | Source |
|---|---|---|
| D1 | Tailwind CSS v4 installed with npm in a new repo-root folder `web-ui/`, versions pinned exactly, `package-lock.json` committed. | user |
| D2 | `npm run build` writes `app/src/main/assets/web/shared/ui.css`; the built file is committed. Gradle, the APK build and the toolchain do not change and need no Node. | user |
| D3 | Nothing loads from the internet at runtime. No Tailwind CDN, no Google Fonts. | privacy rule |
| D4 | Tailwind utilities use the prefix `tw` (`tw:flex`), and mockup components use the prefix `ui-` (`ui-panel`), so neither collides with old classes on pages not yet moved. Tailwind preflight is **not** imported until the last page is moved. | collision safety |
| D5 | Mockup components become `@layer components` classes, one per mockup building block (table below). Pages use these classes; one-off layout uses `tw:` utilities. | user ("every style") |
| D6 | Sidebar 240px (mockup 208), 200px at ≤1150px (mockup 176), 72px icon rail at ≤850px (unchanged). Phone bottom bar at ≤540px as in the mockup. | user ("little larger") |
| D7 | Icons: Phosphor, regular weight (MIT), built into one local SVG sprite from `@phosphor-icons/core`. All web nav, top bar and component icons use it. Native Android icons are out of scope. | user chose Phosphor |
| D8 | Pages move one batch at a time. A moved page keeps every element `id` its scripts use, links `ui.css`, and drops its old inline CSS. | safety |
| D9 | When every page is moved, `styles.css` and `revamp.css` rules no page uses any more are deleted, and preflight is turned on. | cleanup |

### Component map (mockup class → `ui-` class)

| Mockup | Component | Notes |
|---|---|---|
| `.layout`, `.sidebar`, `.nav`, `.brand`, `.nav-label`, `.sidebar-bottom`, `.garage` | `ui-shell`, `ui-sidebar`, `ui-nav`, `ui-brand`, `ui-nav-label`, `ui-sidebar-foot` | rendered by `app-shell.js`; browser only (the native app hides it) |
| `.toolbar`, `.breadcrumb`, `.theme`, `.avatar` | `ui-topbar`, `ui-breadcrumb`, `ui-theme-switch` | 72px tall, page-coloured background |
| `main`, `.page-heading` | `ui-main`, `ui-page-head` | max-width 1480px |
| `.panel`, `.panel-head` | `ui-panel`, `ui-panel-head` | radius 16px, 1px line border, no shadow |
| `.button`, `.button.primary`, `.text-button` | `ui-button`, `ui-button-primary`, `ui-text-button` | min-height 44px |
| `.control-row`, `.switch` | `ui-row`, `ui-switch` | replaces old settings rows and toggles |
| `.metrics`, `.metric` | `ui-metrics`, `ui-metric` | three columns with dividers |
| `.status` | `ui-status` | green dot + label |
| `.filters`, `.filter` | `ui-tabs`, `ui-tab` | replaces old `app-tabs` look |
| `.activity` | `ui-list-item` | icon tile + text + trailing meta |
| `.select` | `ui-select`, `ui-input` | |
| `dialog`, `.toast` | `ui-dialog`, `ui-toast` | |
| `.progress` | `ui-progress` | |
| `.vehicle-stage`, `.vehicle-footer`, `.reading` | `ui-hero`, `ui-hero-foot`, `ui-reading` | home vehicle card |

## Not changing

- Data, API calls, element ids that scripts read, i18n keys, page URLs.
- The native Android screens and their icons.
- Earlier rulings not reopened by the user: no invented data; hex colours only in custom-property definitions;
  `vehicle-control.css` colour picker and `vehicle-control-3d-test.html` exempt.

## Answers (2026-11-17, user chose the recommendation on all three)

1. Negative letter-spacing: **match the mockup**, allowed in `ui.css` only.
2. Home car picture: **photo, like the mockup**; lock and tyre state as text lines under it.
3. Home bottom row: **real data** — energy from charging sessions, activity from recorded events, empty states.

Also: the 57 uncommitted files from the earlier session are committed as-is before Task 1.

## Open questions as asked

1. **Negative letter-spacing.** The mockup tightens headings and numbers (−0.25px to −1.2px). A test
   (`DesignSystemAssetTest`) forbids negative tracking in all web CSS. Recommendation: allow it in `ui.css` only,
   with the mockup's exact values.
2. **Home car picture.** The mockup shows a car photo; home shows a live top-down diagram (locks, tyres).
   Recommendation: photo in the hero as in the mockup, with lock and tyre state moved into hero text lines.
3. **Home bottom row.** The mockup has an energy bar chart and a recent-activity list; home has no such panels
   because it has no such data on that page. Recommendation: fill them from data the app already has (charging
   sessions for energy, recorded events for activity), each with an empty state.
