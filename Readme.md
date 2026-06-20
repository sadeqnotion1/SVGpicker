# SVGpicker

Pull icons out of any codebase, then find similar icons from **Tabler**, **Lucide**, **Font Awesome**, and **Material Symbols** — and export ready-to-paste instructions to swap them with an AI coding terminal.

## What it does

1. **Fetch icons from a source** — three ways:
   - **GitHub repo** — paste `owner/repo`, a `github.com` URL, or a `tree/branch/subfolder` URL.
   - **Local folder** — pick a folder on your PC; everything is scanned in the browser (nothing is uploaded).
   - **Local file(s)** — pick one or more `.svg`/code files directly.
2. It collects both standalone `.svg` files **and** inline `<svg>` markup found in code (HTML, Svelte, Vue, JSX/TSX, JS/TS), de-duplicated.
3. **Find similar** — click any extracted icon to see matching icons across the four libraries (via the Iconify API), grouped by library.
4. **Pick & swap** — copy the icon name / SVG / URL, or queue replacements and export one prompt for your AI terminal.

## Multi-change export

- On any replacement, click **+ Add to changes** (one queued change per source icon).
- Open **Changes** (top-right) to see every queued swap, then **Copy prompt for all changes**.
- The combined prompt lists each change with the exact file path, the OLD SVG, and the NEW SVG, plus guardrails (preserve attributes/sizing/`currentColor`, make a backup, keep edits minimal).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Test

```bash
npx tsx test/extract.test.ts
```

## Notes

- A GitHub token (optional) lifts the 60-requests/hour anonymous rate limit for large repos.
- Target libraries are easy to change in `src/lib/iconify.ts` (add MDI, Phosphor, etc.).
- Since extracted SVGs render inline, only scan sources you trust.

## Layout

```
src/
  App.svelte               UI, source modes, changes queue
  lib/
    github.ts              GitHub repo tree + raw file fetching
    local.ts               local folder / file scanning
    extract.ts             svg extraction + name normalization
    iconify.ts             similar-icon search + svg fetch
    scan.ts                repo scan orchestration
    prompt.ts              single + batch AI-edit prompt builders
  components/
    IconCard.svelte
    SimilarPanel.svelte    find-similar + add-to-changes
    ChangesPanel.svelte    queued swaps + combined prompt
```
