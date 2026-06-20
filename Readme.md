# SVGpicker

Pull icons out of **any GitHub repo**, then find **similar icons** from Tabler, Lucide,
Font Awesome, and Material Symbols — so you can pick a clean, consistent icon for your
own app.

Built with **Svelte + TypeScript + Vite**. Runs entirely in the browser; no backend.

## How it works

1. **Point at a repo** — paste `owner/repo`, a `github.com` URL, or a `tree/<branch>/<sub/path>` URL.
2. **Scan** — SVGpicker lists the repo file tree (GitHub REST API) and pulls icons from:
   - standalone `.svg` files, and
   - inline `<svg>…</svg>` markup inside code (HTML, Svelte, Vue, JSX/TSX, JS/TS, …).
   Duplicate icons are removed automatically.
3. **Pick** — click any extracted icon. SVGpicker derives a search term from its name and
   queries the [Iconify API](https://iconify.design/docs/api/), restricted to the four
   target libraries, then groups the matches by library.
4. **Copy** — grab the icon name (e.g. `tabler:home`), the raw SVG, or a hosted SVG URL.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run check    # type-check with svelte-check
```

## GitHub rate limits

Unauthenticated GitHub API calls are limited to ~60/hour. For large repos or frequent
scans, paste a **personal access token** (no scopes needed for public repos) into the
optional token field. The token is only used for in-browser requests and is never stored.

## Project structure

```
src/
  App.svelte              # UI + scan orchestration
  main.ts                 # app entry
  app.css                 # global theme
  lib/
    github.ts             # parse repo input, resolve branch, list tree, fetch files
    extract.ts            # find SVGs in files, normalize names into search queries
    iconify.ts            # search similar icons across the four libraries
    scan.ts               # full repo scan with bounded concurrency + progress
  components/
    IconCard.svelte       # one extracted icon in the grid
    SimilarPanel.svelte   # similar-icon results + copy actions
test/
  extract.test.ts         # unit tests for the pure logic (npx tsx test/extract.test.ts)
```

## Notes

- Targeted Iconify prefixes: `tabler`, `lucide`, `fa6-solid`, `fa6-regular`, `fa6-brands`,
  `material-symbols`. Adjust them in `src/lib/iconify.ts`.
- Extracted SVGs are rendered inline; only run scans on repos you trust.
