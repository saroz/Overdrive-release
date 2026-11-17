# web-ui

Builds the web app's stylesheet and icons. Runs on a developer machine only; the Android build never calls it.

```
cd web-ui
npm ci            # once
npm run build     # writes app/src/main/assets/web/shared/ui.css (and ph-icons.js)
npm run check     # fails if the committed files are out of date
```

Commit the generated files together with the source change.

- `src/ui.css` — entry: Tailwind v4 (utilities prefixed `tw:`), mockup tokens, `ui-` components.
- `src/tokens.css` — colours and sizes from `docs/superpowers/specs/2026-11-16-web-theme-mockup.html`.
- Nothing in the output loads from the internet.
