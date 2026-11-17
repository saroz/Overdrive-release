# UI theme alignment ? 2026-11-17

The current request supersedes the layout changes proposed in the November 16 plan: preserve the existing native and browser layouts, routes, dashboard readings, controls and bindings. Apply only the reference presentation.

Reference: `C:/Users/PREDATOR/Desktop/YourDrive-theme-preview.html`, SHA-256 `A228417509CA0BCF19523CC96D5F6064E855FD5758794404AFBB186927CC5F2F`. The later refinement rules in that HTML specify 16px panels, 7px controls, 28px page headings, 17px card headings and a monochrome brand mark.

Reviewed the November 16 design, implementation plan and `.superpowers/sdd/2026-11-16-web-theme-redesign/progress.md`. The earlier implementation left a late light-mode teal override in `revamp.css`, separate chart colors, rounded tab bars and native green palettes. These now use the shared reference colors and shapes. Native navigation uses the same rounded outline vocabulary as the browser shell.

The web font stack starts with the reference's Segoe UI Variable / Segoe UI and retains locally bundled Inter as the offline fallback. Native Android retains its platform sans-serif fallback and readable touch-target sizes; Segoe UI is not bundled or downloaded. Existing safety confirmations and vehicle commands are unchanged.

Review helper: set `THEME_REFERENCE` to the source HTML, and `PLAYWRIGHT_MODULE` to an installed Playwright module when it is not on Node's module path. Run `node tools/theme-visual-review.cjs` from the repository root. It serves local assets with empty API fixtures, blocks external requests, captures light/dark pages and responsive/RTL dashboard images, and checks errors, overflow and computed accent colors. Output is in `build/theme-review/`. This verifies offline presentation, not live vehicle operation.

Validation uses installed JDK 21 (`JAVA_HOME`), without changing the repository toolchain. Compare full-suite failures to the 19 names recorded in yesterday's baseline. Device screenshots remain pending when no Android device is connected.

Verified: 4,358 unit tests, 9 skipped, the same 19 baseline failures and no new failures. The 24 recorded browser page/viewport checks report no JavaScript errors, no horizontal overflow, and the correct computed accent in both themes. Native layout element order/constraints and the dashboard DOM/data scripts were compared with HEAD and are unchanged. Screenshots were visually inspected in both themes and at phone width.

## Follow-up: vehicle presentation and Quick controls

The follow-up request explicitly authorizes refining the waiting-state vehicle card, Quick controls and spacing. The prior layout-preservation statement above describes the first pass. The outer dashboard sections and all command/data bindings remain; the vehicle card interior now uses the actual car image extracted from the reference HTML. Waiting is a secondary status, battery/range have a dedicated footer, and the original live tyre/door schematic is available under an expandable summary. Six main controls have equal sizing, outline icons and short descriptions; surrounding panels have more breathing room.

The offline review additionally verifies the reference image loads, all six primary buttons remain, sample live readings reach the battery/range/status elements, and sensor details open. Sample readings exist only in the review helper. Light/dark and responsive checks report no JavaScript errors or horizontal overflow. The 40 targeted UI asset checks pass and the debug APK builds. Live vehicle operation and native device rendering were not exercised.