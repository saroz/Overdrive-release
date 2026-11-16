# Web Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every web page to the owner's approved mockup (light day / neutral dark night, Inter, solid surfaces), restyle the browser shell, and rebuild the browser home page to the mockup layout with all current dashboard data merged in.

**Architecture:** One token file (`web/shared/design-tokens.css`) carries the palette, type and shape for every page; the browser shell (`styles.css`, `app-shell.css`, `app-shell.js`) is restyled to the mockup's sidebar and top bar; `web/local/index.html` is rebuilt to the mockup layout keeping every element ID its script and tests use; then blur and hard-coded colours are removed page by page. Tests are the repo's existing style: JUnit "asset contract" tests that read web files as text.

**Tech Stack:** Static HTML/CSS/vanilla JS served from `app/src/main/assets/web/`; JUnit 4 asset tests in `app/src/test/java/com/overdrive/app/ui/`; Gradle 8.13 / AGP 8.13.2.

**Spec:** `docs/superpowers/specs/2026-11-16-web-theme-redesign-design.md` (reference mockup: `docs/superpowers/specs/2026-11-16-web-theme-mockup.html`)

## Global Constraints

- Edit web files only under `app/src/main/assets/web/shared/` and `.../web/local/`; never edit through the `web/local/shared` symlink.
- Never touch `verifyFastCam`/checksums, toolchain versions, signing config or `app/src/main/jniLibs`; build the debug APK only.
- No runtime request to any third party: no Google Fonts, no CDN; Inter is bundled.
- No negative `letter-spacing` anywhere in web CSS/HTML (enforced by `DesignSystemAssetTest`); the mockup's negative tracking is dropped.
- No `backdrop-filter`, translucent surfaces, glows or blur on surfaces; solid colours, 1px borders.
- Token values are exactly the spec's table. Light: page `#f4f6f8`, surface `#ffffff`, soft `#f7f8fa`, line `#e5e9ef`, ink `#182431`, muted `#667180`, accent `#db4f1c`, accent-soft `#fff0e9`, green `#257355`, green-soft `#edf7f1`, red `#bd3e37`, hero `#edf1f5`, chart-2 `#a4b3c4`, chart-3 `#d7dfe8`. Dark: page `#191a1b`, surface `#242627`, soft `#2d2f30`, line `#3c3e40`, ink `#f5f3f0`, muted `#b7b7b4`, accent `#ff8068`, accent-soft `#3c2b28`, green `#89c9aa`, green-soft `#28372f`, red `#ffa49a`, hero `#2b2e2f`, chart-2 `#a1a5a5`, chart-3 `#626767`.
- Small orange text uses `--primary-text`: light `#c2410c` (5.2:1 on white), dark `#ff8068`. `--primary` (`#db4f1c` / `#ff8068`) is for fills, borders, bars and large text.
- Radii: 7px controls, 12px small panels, 16px cards. Cards: 1px `--outline-variant` border, no shadow.
- Keep the existing `:root[data-android-embed="1"]` size bump and 48px/56px targets.
- Keep every element ID and `data-i18n` key that scripts or tests reference; move, don't rename. New visible text gets an i18n key with English fallback in `web/i18n/en.json`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A token defined for light but not dark** leaks a light colour into night mode. Test `everyLightTokenHasADarkValue` in Task 1.
2. **Hebrew/Arabic (RTL)**: the shell must mirror, sidebar on the right. Test `shellUsesLogicalProperties` in Task 2.
3. **Missing data** (BEV has no fuel, car without tyre sensors, vehicle offline): slots stay hidden, never show invented values. Test `optionalSlotsStartHidden` in Task 4.
4. **Inside the app** the web sidebar/top bar must never render (native menu is there) and driving-size text stays. Test `shellChromeSkipsTheNativeApp` in Task 2; `embedSizesKept` in Task 1.
5. **Small orange text** fails contrast if `--primary` is used for it. Test `smallAccentTextUsesPrimaryText` in Task 1.

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Confirm with the owner, then commit pending work on `fix/stale-contract-tests` as two commits**

```bash
git add app/src/test
git commit -m "test: update contract tests after intentional source changes"
git add app/src/main/java/com/overdrive/app/analytics/AnalyticsPinger.kt
git commit -m "fix(privacy): make the daily analytics ping opt-in"
```

- [ ] **Step 2: Branch for this work and add the spec**

```bash
git switch -c feat/web-theme-redesign
git add docs/superpowers/specs/2026-11-16-web-theme-redesign-design.md docs/superpowers/specs/2026-11-16-web-theme-mockup.html docs/superpowers/plans/2026-11-16-web-theme-redesign.md
git commit -m "docs: web theme redesign design, mockup and plan"
```

- [ ] **Step 3: Record the failure baseline**

Run: `./gradlew :app:testDebugUnitTest --console=plain` then count failures in `app/build/test-results/testDebugUnitTest/*.xml`.
Expected: 23 failures, all in the Windows-only list in the spec's notes. Save the failing test names to compare after each task.

---

### Task 1: Tokens and bundled Inter

**Files:**
- Create: `app/src/main/assets/web/shared/fonts/InterVariable.woff2`, `app/src/main/assets/web/shared/fonts/OFL.txt`
- Modify: `app/src/main/assets/web/shared/design-tokens.css` (whole file), `styles.css:10` (`@import`), `revamp.css:6` (`@import`), `web/local/login.html:9`
- Modify test: `app/src/test/java/com/overdrive/app/ui/DesignSystemAssetTest.java:92`
- Create test: `app/src/test/java/com/overdrive/app/ui/WebThemeTokensAssetTest.java`

**Interfaces:**
- Produces tokens later tasks use (both themes): `--primary`, `--primary-text`, `--on-primary`, `--primary-container`, `--surface`, `--surface-container`, `--surface-container-high`, `--outline-variant`, `--on-surface`, `--on-surface-variant`, `--status-success`, `--status-success-container`, `--status-danger`, `--status-warning`, `--hero`, `--chart-2`, `--chart-3`, `--radius-control: 7px`, `--radius-panel: 12px`, `--radius-card: 16px`, `--family-sans`.

- [ ] **Step 1: Write the failing tests** in `WebThemeTokensAssetTest` (copy the `readRepositoryFile` helper pattern from `DesignSystemAssetTest`):

```java
@Test public void lightAndDarkPalettesMatchTheMockup() {
    // light block = ':root[data-theme="light"] { ... }', dark block = first ':root { ... }'
    assertToken(light, "--surface-container", "#ffffff");   assertToken(dark, "--surface-container", "#242627");
    assertToken(light, "--background", "#f4f6f8");          assertToken(dark, "--background", "#191a1b");
    assertToken(light, "--on-surface", "#182431");          assertToken(dark, "--on-surface", "#f5f3f0");
    assertToken(light, "--on-surface-variant", "#667180");  assertToken(dark, "--on-surface-variant", "#b7b7b4");
    assertToken(light, "--outline-variant", "#e5e9ef");     assertToken(dark, "--outline-variant", "#3c3e40");
    assertToken(light, "--primary", "#db4f1c");             assertToken(dark, "--primary", "#ff8068");
    assertToken(light, "--primary-text", "#c2410c");        assertToken(dark, "--primary-text", "#ff8068");
    assertToken(light, "--status-success", "#257355");      assertToken(dark, "--status-success", "#89c9aa");
    assertToken(light, "--hero", "#edf1f5");                assertToken(dark, "--hero", "#2b2e2f");
}
@Test public void everyLightTokenHasADarkValue()   // each --name set in the light block is also set in the dark block
@Test public void interIsBundledAndLocal() {
    assertTrue(tokens.contains("--family-sans: 'Inter', system-ui"));
    assertTrue(tokens.contains("src: url(\"fonts/InterVariable.woff2\") format(\"woff2\")"));
    assertTrue(Files.isRegularFile(locate("app/src/main/assets/web/shared/fonts/InterVariable.woff2")));
    assertTrue(Files.isRegularFile(locate("app/src/main/assets/web/shared/fonts/OFL.txt")));
}
@Test public void embedSizesKept()        // tokens still contain ':root[data-android-embed="1"]' with '--target: 56px'
@Test public void smallAccentTextUsesPrimaryText() // contrast(--primary-text light, #ffffff) >= 4.5 using DesignSystemAssetTest's contrast()
@Test public void cardsAreSolid()          // tokens contain no 'rgba(' in --tile/--surface* values and no 'backdrop-filter'
```

In `DesignSystemAssetTest.java:92` change the assertion to `assertTrue(tokens.contains("--family-sans: 'Inter', system-ui"));` (its intent, local type, is unchanged).

- [ ] **Step 2: Run to verify they fail**

Run: `./gradlew :app:testDebugUnitTest --tests '*WebThemeTokensAssetTest' --tests '*DesignSystemAssetTest' --console=plain`
Expected: FAIL (old teal values, `system-ui` family, no font file).

- [ ] **Step 3: Add Inter.** Download `Inter-4.1.zip` from `https://github.com/rsms/inter/releases/tag/v4.1` into a new empty temp folder; copy `web/InterVariable.woff2` and `LICENSE.txt` (rename `OFL.txt`) into `web/shared/fonts/`.

- [ ] **Step 4: Rewrite `design-tokens.css`.** Keep its three-block structure (dark `:root`, `:root[data-theme="light"]`, `:root[data-android-embed="1"]`) and every existing token name (legacy aliases included). Set values from the spec table (see Global Constraints; mapping column of the spec says which existing names each mockup colour sets). Add `@font-face { font-family: 'Inter'; src: url("fonts/InterVariable.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }`, `--family-sans: 'Inter', system-ui, sans-serif`, the new tokens from Interfaces, all `--tracking-*: 0`, `--shadow-sm/md: none` for cards with `--shadow-lg: 0 4px 20px #1a2c4210` (dark `#0002`) for dialogs, `--tile-shadow: none`, `--sheen`/`--glow-*` transparent, secondary/tertiary set to neutral greys (light `#667180`, dark `#b7b7b4`), warning amber light `#a15c07` dark `#f2b45b`. Replace the header comment: "Hand-maintained; dev/design-tokens.json is not in this repo."

- [ ] **Step 5: Bust caches.** `styles.css:10` → `@import url("design-tokens.css?v=3");`, `revamp.css:6` → `?v=3`, `login.html:9` → `../shared/design-tokens.css?v=3`.

- [ ] **Step 6: Run the tests**

Run: same command as Step 2. Expected: PASS.

- [ ] **Step 7: Full suite against baseline**

Run: `./gradlew :app:testDebugUnitTest --console=plain`. Expected: the same 23 Windows-only failures, no new ones.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/assets/web/shared/fonts app/src/main/assets/web/shared/design-tokens.css app/src/main/assets/web/shared/styles.css app/src/main/assets/web/shared/revamp.css app/src/main/assets/web/local/login.html app/src/test/java/com/overdrive/app/ui/WebThemeTokensAssetTest.java app/src/test/java/com/overdrive/app/ui/DesignSystemAssetTest.java
git commit -m "feat(web): new palette, shapes and bundled Inter in design tokens"
```

---

### Task 2: Browser shell (sidebar and top bar)

**Files:**
- Modify: `app/src/main/assets/web/shared/app-shell.css` (remove `.sidebar::before` stripe; sidebar/nav/top bar rules), `styles.css` (base `.sidebar`, `.nav-link` rules), `app-shell.js` (markup only: breadcrumb + theme switch in the top bar, "My garage" block at the sidebar bottom), `app-tabs.css` (≤540px bottom bar look)
- Create test: `app/src/test/java/com/overdrive/app/ui/WebShellAssetTest.java`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: CSS classes `.shell-topbar`, `.shell-breadcrumb`, `.shell-theme-switch` (two `button[aria-pressed]`), `.sidebar-garage`; JS `renderTopbar(pageTitle: string): void` inside `app-shell.js`, called from `mount()` only when `!embeddedInNativeApp`.

- [ ] **Step 1: Write the failing tests**

```java
@Test public void sidebarMatchesMockup() {
    assertTrue(shell.contains("--sidebar-width: 208px"));
    assertFalse(shell.contains(".sidebar::before"));                         // gradient stripe gone
    assertTrue(shell.contains("background: var(--primary-container)"));      // active item
    assertTrue(shell.contains("color: var(--primary-text)"));
    assertTrue(shell.contains("border-radius: var(--radius-control)"));
}
@Test public void topbarHasBreadcrumbAndThemeSwitch() {
    assertTrue(js.contains("function renderTopbar("));
    assertTrue(shell.contains(".shell-topbar") && shell.contains("height: 72px"));
    assertTrue(js.contains("aria-pressed"));                                   // switch state is announced
}
@Test public void breakpointsMatchMockup()  // shell css contains '@media (max-width: 1150px)', '(max-width: 850px)', '(max-width: 540px)'
@Test public void shellUsesLogicalProperties() // shell css uses 'border-inline-end' for the sidebar edge and no 'border-right:' in sidebar rules
@Test public void shellChromeSkipsTheNativeApp() // js: renderTopbar call is guarded by 'if (!embeddedInNativeApp)'
```

Keep `DesignSystemAssetTest.collapsedSidebarGroupsLeaveTheFlexLayout` passing (the `.sidebar-nav [hidden]` rule stays verbatim).

- [ ] **Step 2: Run to verify they fail**

Run: `./gradlew :app:testDebugUnitTest --tests '*WebShellAssetTest' --console=plain` — Expected: FAIL.

- [ ] **Step 3: Implement** per the spec's "Browser shell" section and the mockup's `.sidebar`, `.nav`, `.toolbar`, `.theme`, `.garage` rules, translated to tokens and logical properties. The theme switch calls the existing `BYD.theme.set('light'|'dark')`. Existing menu entries and routes are unchanged.

- [ ] **Step 4: Run tests** — same command plus `--tests '*DesignSystemAssetTest'`. Expected: PASS.

- [ ] **Step 5: Look at it.** `./gradlew assembleDebug`, install, `adb forward tcp:8080 tcp:8080`, open `http://localhost:8080/trips.html` in a browser at 1280, 850, 540 and 360px wide, light and dark, then again with Hebrew chosen in the language picker (globe icon). Expected: sidebar/top bar match the mockup; RTL puts the sidebar on the right. In the emulator app no web sidebar or top bar appears.

- [ ] **Step 6: Full suite against baseline, then commit**

```bash
git add app/src/main/assets/web/shared/app-shell.css app/src/main/assets/web/shared/styles.css app/src/main/assets/web/shared/app-shell.js app/src/main/assets/web/shared/app-tabs.css app/src/test/java/com/overdrive/app/ui/WebShellAssetTest.java
git commit -m "feat(web): restyle browser sidebar and top bar to the new design"
```

---

### Task 3: Home page layout (markup and styles)

**Files:**
- Modify: `app/src/main/assets/web/local/index.html` (markup `#dashCards` region, lines ~45–420, and its `<style>` block)
- Modify test: `app/src/test/java/com/overdrive/app/ui/DashboardDriveStateAssetTest.java:25-28` (layout-string assertions only)
- Create test: `app/src/test/java/com/overdrive/app/ui/HomeLayoutAssetTest.java`

**Interfaces:**
- Produces section IDs used by Task 4: `homeHeading` (with `homeSummary` text node), `homeVehicle` (`homeVehicleState` line, `homeVehicleImage`, footer cells `homeBattery`, `homeRange`, `homeTyres`, `homeFuel`), `homeControls` (`homeLockRow`, `homeClimate`, `homeConnectivity`), `homeStats`, `homeLocationStrip`, `homeEnergy`, `homeActivity`, dialog `homeDetailsDialog`.
- Keeps every existing ID (`dashDriveState`, `dashDrivePower`, `dashDriveMode`, `dashDriveGear`, `dashDriveSpeed`, `dashSoc`, `dashRange`, `dashFuelMetric`, `dash12v`, `dashAcc`, `dashNetwork`, `dashBluetoothMetric`, `dashLock`, `dashOdoMetric`, `dashGlance`, …) inside the slot the spec's merge table assigns.

- [ ] **Step 1: Write the failing test** `HomeLayoutAssetTest`:

```java
@Test public void mockupSectionsInOrder()  // index.html contains, in this order: id="homeHeading", id="homeVehicle", id="homeControls", id="homeStats", id="homeLocationStrip", id="homeEnergy", id="homeActivity"
@Test public void everyScriptedIdSurvives() // for each ID in the Interfaces list above: index.html contains 'id="<ID>"' exactly once
@Test public void mergedSlotsLiveInTheirSections() // dashDriveState inside homeVehicle; dashSoc and dashRange inside homeVehicle; dashLock inside homeControls; dashNetwork inside homeControls; dash12v, dashAcc, dashOdoMetric inside homeDetailsDialog
@Test public void noDragReorderOnHome()     // index.html contains no 'dash-card-grip'
@Test public void layoutUsesTokensOnly()     // the <style> block of index.html has no raw '#rgb'/'#rrggbb' outside var(--x, fallback)
```

Update `DashboardDriveStateAssetTest:25-28`: replace the four old grid strings with assertions that `dashDriveState` sits inside `id="homeVehicle"` (same intent: drive state is shown in the vehicle glance).

- [ ] **Step 2: Run to verify it fails** — `--tests '*HomeLayoutAssetTest' --tests '*DashboardDriveStateAssetTest'`. Expected: FAIL.

- [ ] **Step 3: Rebuild the markup and `<style>`** to the mockup's `.page-heading`, `.overview` (vehicle panel + controls panel), `.metrics`, `.location-strip`, `.details` (energy + activity) using tokens, moving each existing element into the slot from the spec's merge table. Car image: copy `res/drawable-nodpi/vehicle_<model>.webp` handling as the page does today; clean halo pixels for any image you add with `ffmpeg -i in.webp -vf "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(alpha(X,Y),48),0,alpha(X,Y))'" out.webp`. Remove card drag handles and their CSS.

- [ ] **Step 4: Run tests** — same command, plus `--tests '*DashboardFreshnessAssetTest' --tests '*ScreenshotPrivacyModeAssetTest' --tests '*GenAiAssetContractTest' --tests '*ChargingFrontendContractTest'`. Expected: PASS.

- [ ] **Step 5: Full suite against baseline, then commit**

```bash
git add app/src/main/assets/web/local/index.html app/src/test/java/com/overdrive/app/ui/HomeLayoutAssetTest.java app/src/test/java/com/overdrive/app/ui/DashboardDriveStateAssetTest.java
git commit -m "feat(web): home page layout from the approved mockup"
```

---

### Task 4: Home page data in the new slots

**Files:**
- Modify: `app/src/main/assets/web/local/index.html` (inline script: `refreshVehicleState`, status refresh, brief, charging, location), `app/src/main/assets/web/i18n/en.json` (new keys under `dashboard.home.*`)
- Create test: `app/src/test/java/com/overdrive/app/ui/HomeDataSlotsAssetTest.java`

**Interfaces:**
- Consumes: Task 3 IDs.
- Produces (inline script functions): `renderHomeSummary(brief: string|null, state: object): void`, `renderLockRow(doors: object): void`, `renderTyres(tyres: object|null): void`, `renderBatteryBlock(status: object, charging: object|null): void`, `renderLocationStrip(location: object|null): void`, `openHomeDetails(): void`.

- [ ] **Step 1: Write the failing tests**

```java
@Test public void summaryPrefersTheBrief()      // script contains 'function renderHomeSummary(' and uses the brief text when non-empty, else data-i18n key 'dashboard.home.summary_parked'
@Test public void lockRowNamesTheOpenDoor()     // 'function renderLockRow(' and en.json has 'all_doors_locked' and 'door_unlocked' keys under dashboard.home
@Test public void chargingTakesOverTheBattery() // 'function renderBatteryBlock(' and en.json key 'charging_full_at' with placeholders for power and time
@Test public void optionalSlotsStartHidden()    // index.html: id="homeTyres" and id="dashFuelMetric" carry 'hidden' (or display:none) in markup; renderTyres(null) path re-hides
@Test public void noInventedValues()            // script never assigns literal sample values (e.g. '341', '82%', '2.5 bar') to slots
```

- [ ] **Step 2: Run to verify they fail** — `--tests '*HomeDataSlotsAssetTest'`. Expected: FAIL.

- [ ] **Step 3: Implement the six functions** wiring the data the page already fetches (`/api/status`, `/api/vehicle/state`, the brief endpoint, charging, location) into the slots exactly as the spec's merge table says. Controls call the existing vehicle-control endpoints with their existing confirmations. Add the new i18n keys to `en.json` only (other locales fall back to English).

- [ ] **Step 4: Run tests** — same command plus Task 3's list. Expected: PASS.

- [ ] **Step 5: Look at it.** Build, install, open `http://localhost:8080/` and the in-app dashboard at 1920×1080/240 dpi, light and dark. Compare side by side with `docs/superpowers/specs/2026-11-16-web-theme-mockup.html`. With the emulator (no vehicle data) every optional slot is hidden or shows "--", never sample numbers.

- [ ] **Step 6: Full suite against baseline, then commit**

```bash
git add app/src/main/assets/web/local/index.html app/src/main/assets/web/i18n/en.json app/src/test/java/com/overdrive/app/ui/HomeDataSlotsAssetTest.java
git commit -m "feat(web): show drive state, locks, tyres, charging and location in the new home layout"
```

---

### Task 5: Remove blur everywhere

**Files:**
- Modify: every web file with `backdrop-filter` (currently 16: `shared/styles.css`, `revamp.css`, `app-shell.css`, `app-tabs.css`, `automations.css`, `remote-access.css`, `video-player.css`, `theme.js`, `local/charging.html`, `trips.html`, `events.html`, `live-view.html`, `notifications.html`, `key-mapping.html`, `remote-dev-view.html`, `vehicle-control-3d-test.html`)
- Create test: `app/src/test/java/com/overdrive/app/ui/NoBlurAssetTest.java`

- [ ] **Step 1: Write the failing test** `noSurfaceUsesBackdropBlur`: walk `app/src/main/assets/web` (`.css`, `.html`, `.js`, skipping `vendor/` and `leaflet.*`) and assert no file contains `backdrop-filter`.
- [ ] **Step 2: Run** `--tests '*NoBlurAssetTest'` — Expected: FAIL listing the files.
- [ ] **Step 3: Replace** each blurred, translucent surface with its solid token (`--surface-container`, or `--scrim` at full opacity for overlays behind dialogs).
- [ ] **Step 4: Run** — Expected: PASS. Full suite against baseline.
- [ ] **Step 5: Commit** `git commit -am "style(web): replace blurred surfaces with solid ones"` (stage the test file first).

---

### Task 6: Hard-coded colours, heavy pages

**Files:**
- Modify: `<style>` blocks in `web/local/trips.html`, `events.html`, `charging.html`, `live-view.html`, `notifications.html`, `performance.html`
- Create test: `app/src/test/java/com/overdrive/app/ui/TokenOnlyColoursAssetTest.java`

**Interfaces:**
- Produces helper in the test: `static List<String> rawHexOutsideVarFallback(String css)` — returns each `#rgb/#rrggbb/#rrggbbaa` not inside a `var(--name, …)` fallback.

- [ ] **Step 1: Write the failing test** `heavyPagesUseTokens`: for each of the six pages, `rawHexOutsideVarFallback(<style> contents)` is empty.
- [ ] **Step 2: Run** `--tests '*TokenOnlyColoursAssetTest'` — Expected: FAIL with the offending values.
- [ ] **Step 3: Replace** each raw colour with the nearest token (chart series: `--primary`, `--chart-2`, `--chart-3`; states: `--status-*`).
- [ ] **Step 4: Run** — PASS. Screenshot each page light/dark in the browser; full suite against baseline.
- [ ] **Step 5: Commit** `git commit -m "style(web): token colours on trips, events, charging, live view, notifications, performance"`.

---

### Task 7: Hard-coded colours, remaining pages and shared CSS

**Files:**
- Modify: remaining `web/local/*.html` `<style>` blocks and `web/shared/*.css` (excluding `design-tokens.css`, `leaflet.css`, `vendor/`)
- Modify test: `TokenOnlyColoursAssetTest` — add `allWebStylesUseTokens` covering every such file.

- [ ] **Step 1: Add the failing test**, **Step 2: run** (FAIL), **Step 3: replace colours**, **Step 4: run** (PASS) + full suite against baseline, **Step 5: commit** `"style(web): token colours across remaining pages"` — same pattern as Task 6.

---

### Task 8: Final verification

- [ ] **Step 1:** `./gradlew :app:testDebugUnitTest --console=plain` — Expected: only the 23 baseline failures.
- [ ] **Step 2:** `./gradlew assembleDebug` — Expected: BUILD SUCCESSFUL.
- [ ] **Step 3:** Install on the emulator at `wm size 1920x1080; wm density 240`; open Dashboard, Live view, Recordings settings, Vehicle, Charging, Trips, Automations in light and dark; screenshot each. Expected: new palette, Inter, no blur, nothing unreadable.
- [ ] **Step 4:** In a desktop browser at `http://localhost:8080`, open the network panel and reload the home page and Trips. Expected: every request goes to `localhost:8080` or the existing keyless OSM tile host; none to fonts or CDNs.
- [ ] **Step 5:** Using the language picker, check RTL with Hebrew and long text with German at 850px and 540px. Expected: no overflow or clipped labels.
- [ ] **Step 6:** Report results to the owner with screenshots; offer the native-screen recolour (`colors_m3.xml`) as the next design.
