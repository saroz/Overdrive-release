# Web theme redesign — design

Date: 2026-11-16
Reference mockup (approved by the owner): [`2026-11-16-web-theme-mockup.html`](2026-11-16-web-theme-mockup.html)

## Intent

The owner is turning this fork into their own app. The current web UI (Material 3, teal accent) feels
"dumb" to them. They want the web screens to look like the reference mockup: simple, clean, pixel-perfect,
nothing blurry, every element clear. The web layer is restyled first because one theme file reaches most
screens at once — the ~20 in-app WebView pages and the browser dashboard at `localhost:8080`.

## Goals

- Every web page uses the mockup's palette, type and shapes, in light (day) and dark (night).
- The browser shell (sidebar + top bar) matches the mockup.
- The browser home page (`web/local/index.html`) uses the mockup's dashboard layout.
- Inter is bundled locally; no font or other asset is fetched from the internet.
- Looks right on the car screen (1920×1080 at 240 dpi → 1280×720 CSS px) and on a phone browser.

## Non-goals

- Native Android screens (Dashboard, Settings, Recordings library, native sidebar). They are recoloured
  later from `res/values{,-night}/colors_m3.xml` to match; separate design.
- New features or new data. The redesign only shows what the app already provides.
- Rebuilding the layout of every page. Pages other than the home page keep their structure and pick up
  the new style through tokens.
- Renaming the app or package (`com.overdrive.app` stays).

## Anti-goals (failure even if it "works")

- Anything translucent, frosted, glowing or blurred. Solid surfaces only.
- Any request to a third party at runtime (Google Fonts, CDNs).
- A broken feature or a failing test that passed before (Windows-only failures excepted, see
  `windows-test-baseline` notes: 23 known).
- Fake data on real screens. If the app has no data for an element, the element is left out.

## Constraints

- `web/shared/design-tokens.css` says it is generated from `dev/design-tokens.json`, but `dev/` is not in
  the repo. Edit the CSS directly and update its header comment to say so.
- Theme switching already works: `theme.js` stamps `data-theme` (`light` | `dark`, "auto" follows the
  system); inside the app `WebViewFragment` stamps it from Android settings. Keep that mechanism.
- Inside the app the web shell's sidebar is not rendered (`app-shell.js` checks `AndroidBridge`).
  The mockup sidebar/top bar therefore applies to the browser only.
- `web/local/shared` is a symlink to `../shared`; edit files under `web/shared/` only.
- 11 unit tests read web CSS files and some assert on text in pages. Keep asserted strings/IDs, or update
  the test with the same intent when a change is deliberate (check the test's purpose first).
- Build rules from the owner: never touch `verifyFastCam`/checksums, toolchain versions, signing,
  `jniLibs`; debug APK only.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Change the existing token values, restyle the shell, rebuild the home page, then clean up hard-coded colours page by page | Most screens change in step 1; each step testable and revertible; layouts other than home change gradually | **Chosen** by the owner |
| B | Separate "warm theme" stylesheet layered over the old one, switchable | Easy to compare, but every page must load it and old/new rules fight; git already gives rollback | Rejected |
| C | Rebuild main pages from scratch to the mockup | Closest match, but breaks structure tests and JS rely on; many sessions | Rejected (home page only gets a rebuild, inside A) |

## Design

### Tokens (`web/shared/design-tokens.css`)

Map the mockup's variables onto the existing token names so existing pages restyle without edits.

| Mockup | Light | Dark | Existing token(s) it sets |
|---|---|---|---|
| `--page` | `#f4f6f8` | `#191a1b` | `--background`, `--surface`, `--page` |
| `--surface` | `#ffffff` | `#242627` | `--surface-container`, `--tile`, `--tile-raised` |
| `--soft` | `#f7f8fa` | `#2d2f30` | `--surface-container-high`, `--well`, `--state-hover` base |
| `--line` | `#e5e9ef` | `#3c3e40` | `--outline-variant`, `--hairline` |
| `--ink` | `#182431` | `#f5f3f0` | `--on-surface`, `--on-background` |
| `--muted` | `#667180` | `#b7b7b4` | `--on-surface-variant`, `--outline` |
| `--accent` | `#db4f1c` | `#ff8068` | `--primary` (`--on-primary` `#ffffff` / `#201711`) |
| `--accent-soft` | `#fff0e9` | `#3c2b28` | `--primary-container`, `--primary-soft` |
| `--green` | `#257355` | `#89c9aa` | `--status-success` |
| `--green-soft` | `#edf7f1` | `#28372f` | `--status-success-container` |
| `--red` | `#bd3e37` | `#ffa49a` | `--status-danger`, `--error` |
| `--hero` | `#edf1f5` | `#2b2e2f` | new `--hero` (vehicle stage) |
| `--chart2` / `--chart3` | `#a4b3c4` / `#d7dfe8` | `#a1a5a5` / `#626767` | new `--chart-2`, `--chart-3` |

- Warning keeps an amber that passes contrast on both surfaces (builder's call; mockup has none).
- Tertiary/secondary tokens move to neutral greys so no teal or sky-blue remains.
- Shadows: cards have no shadow, only a 1px `--line` border (mockup `.panel`); `--shadow` `0 4px 20px #1a2c4210` only for dialogs.
- Shape: radius 7px for buttons, inputs, menu items; 12px for small panels; 16px for cards (`.panel`).
- Remove the sidebar accent gradient stripe (`app-shell.css` `.sidebar::before`).

### Type

- Bundle Inter (variable, Latin + Latin-ext, `.woff2`) in `web/shared/fonts/` with its OFL licence file;
  declare `@font-face` in `design-tokens.css`; `--family-sans: 'Inter', system-ui, sans-serif`.
- Scale from the mockup: page title 28px/650, card title 17px/650, big readings 29px/650, body 14px,
  labels 12–13px, captions 11–12px. Inside the app keep the existing `data-android-embed` bump
  (+1–2px, 56px targets) so it stays readable while driving.
- Tabular figures for all numbers.

### Browser shell (`styles.css`, `app-shell.css`, `app-shell.js` markup only where needed)

- Sidebar 208px, white surface, right border; brand mark (dark square with "Y"), menu items 44px tall,
  radius 7px, active = `--accent` text on `--accent-soft`; group labels 11px muted sentence case;
  "My garage" block pinned at the bottom.
- Top bar 72px: breadcrumb left, two-icon day/night switch right (sun/moon, pressed state = surface +
  small shadow). Same transparent-on-page look as the mockup's refinement.
- Breakpoints as in the mockup: ≤1150px sidebar 176px; ≤850px icon-only 72px rail; ≤540px bottom
  navigation bar with a "More" sheet.
- Existing menu entries and routes stay; only presentation changes.

### Home page (`web/local/index.html`)

Mockup layout, fed by the data and endpoints the current page already uses:
1. Page heading: title, one-line state summary, "Vehicle details" button.
2. Row: vehicle card (stage on `--hero` with the car image for the configured model, sentry/recording
   status, battery level + bar, estimated range) and car controls card (lock switch, climate on/off with
   −/+ temperature, Find car, Cameras).
3. Three plain stats with dividers (distance today, efficiency, recordings today + review link).
4. Row: energy chart (solid bars, dashed grid) and recent activity with a filter dropdown.

Controls call the existing vehicle-control endpoints and keep their existing confirmations and
"refused while moving" behaviour.

**Merging the current home page into the layout** (owner's decision: "merge them into the layout").
Every live reading the current page shows keeps a place; nothing is dropped.

| Current part (`index.html`) | Goes to |
|---|---|
| AI "Vehicle brief" | Page-heading summary line (falls back to the plain state line when no brief) |
| Drive state: power, gear, speed (`dashDriveState`) | Vehicle card heading line under the name: "Parked" / "Driving, D, 64 km/h" |
| Door-lock pills per door (schematic) | Lock row description: "All doors locked" or the door that is open/unlocked |
| Tyre pressure + temperature per corner | Third column in the vehicle card footer ("Tyres": lowest pressure, warning colour if any corner is off); all four corners in Vehicle details |
| Climate / windows glance | Climate block in Car controls (state, set temperature); windows in Vehicle details |
| Live charging strip (power, time to full, kWh) | Battery block: "Unplugged" becomes "Charging, 7.2 kW, full at 23:40" and the bar turns accent |
| Charging card | Merged into the battery block above, with a link to the Charging page |
| Vehicle location map | A one-line location strip under the stats (place, state, last update, "Open map") plus the "At home" link in the vehicle card |
| Main info: battery, range | Vehicle card footer (already) |
| Main info: fuel (PHEV only) | Extra footer column, shown only when `/api/status` reports fuel |
| Main info: 12 V, power (ACC), odometer | Vehicle details dialog/page |
| Main info: network, Bluetooth | Car controls header status ("Online" plus network name; Bluetooth state in its tooltip/details) |
| Main info: lock | Lock row (already) |

My call: the current page lets cards be dragged into a new order; the mockup layout is fixed, so
reordering is removed from the home page (the owner can ask to keep it).

The car image comes from the existing vehicle images; halo pixels are cleaned (alpha < 48 → 0) so no
box shows on either theme.

### Other pages

They inherit the new tokens. Then, page by page, replace the ~340 hard-coded colours with tokens,
starting with the pages that carry their own styles: `trips.html`, `events.html`, `charging.html`,
`live-view.html`, `notifications.html`, `performance.html`.

## Verification

- `./gradlew :app:testDebugUnitTest`: no new failures against the Windows baseline.
- `./gradlew assembleDebug`, install on the emulator at 1920×1080/240 dpi; screenshot each touched page in
  light and dark and compare with the mockup; check the browser at `localhost:8080` at 1280, 850, 540 and
  360px widths.
- No network request other than to the car's own server when a page loads (check the browser's network
  panel).

## Left to the builder

- Exact amber warning colour; hover/pressed shades derived from the palette.
- How to split the work into commits (one per phase above is a good default).
- Whether a token is dropped or aliased when nothing uses it.
- Keep every element ID the page's JavaScript and the tests use (`dashSoc`, `dashRange`, `dashLock`, …),
  moving them to their new slots rather than renaming; new visible text gets i18n keys with English
  fallback.

## Calls made without the owner (check these)

- Inter replaces Segoe UI from the mockup (owner chose Inter).
- In-app text keeps the existing larger `data-android-embed` sizes for driving.
- Card drag-to-reorder is removed from the home page.
- Warning amber is the builder's choice (mockup has none).
