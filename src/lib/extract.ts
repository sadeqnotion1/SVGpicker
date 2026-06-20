// Extract SVG icons from repo files: standalone .svg files and inline <svg> markup
// embedded in code (HTML, Svelte, Vue, JSX/TSX, JS/TS, etc.). Also derives a clean
// search query from each icon's name so we can find similar icons later.

export interface ExtractedIcon {
  id: string
  name: string
  rawName: string
  query: string
  path: string
  svg: string
  source: "file" | "inline"
}

const CODE_EXT = [
  "html", "htm", "svelte", "vue", "jsx", "tsx", "js", "ts", "mjs", "cjs",
  "md", "mdx", "astro", "php", "erb", "twig", "liquid",
]

const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|coverage|vendor)\//

// Tokens that describe styling/size rather than the icon concept itself.
const NOISE = new Set([
  "icon", "icons", "ic", "svg", "sized", "outline", "outlined", "filled", "fill",
  "solid", "regular", "line", "duotone", "sharp", "round", "rounded", "twotone",
  "px", "dp", "logo", "glyph", "the",
])

export function isSvgFile(path: string): boolean {
  return /\.svg$/i.test(path)
}

export function isCodeFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return CODE_EXT.includes(ext)
}

export function shouldScan(path: string): boolean {
  if (SKIP_DIR.test("/" + path)) return false
  return isSvgFile(path) || isCodeFile(path)
}

export function baseName(path: string): string {
  const file = path.split("/").pop() ?? path
  return file.replace(/\.[a-z0-9]+$/i, "")
}

/** Turn a raw icon name into a display name + a clean search query. */
export function normalizeName(raw: string): { name: string; query: string } {
  const base = raw.replace(/\.[a-z0-9]+$/i, "")
  const spaced = base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .toLowerCase()
  const tokens = spaced.split(/\s+/).filter(Boolean)
  const meaningful = tokens.filter((t) => !NOISE.has(t) && !/^\d+(px|dp|pt|rem|em|x)?$/.test(t))
  const query = (meaningful.length ? meaningful : tokens).join(" ").trim()
  return { name: base, query: query || base.toLowerCase() }
}

export function cleanSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
}

function attr(openTag: string, name: string): string | null {
  const m = openTag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))
  return m ? m[1] : null
}

/** Best-effort name for an inline svg from its attributes. */
function guessInlineName(svg: string): string | null {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] ?? svg
  const direct = attr(open, "aria-label") || attr(open, "data-icon") || attr(open, "data-testid") || attr(open, "title")
  if (direct) return direct
  const cls = attr(open, "class")
  if (cls) {
    // Prefer a class that carries a name after an icon prefix, e.g. "icon-trash", "fa-user".
    const tok = cls.split(/\s+/).find((c) => /^(icon|ic|fa6?|i)[-_][a-z0-9]/i.test(c))
    if (tok) return tok.replace(/^(icon|ic|fa6?|i)[-_]/i, "")
  }
  const id = attr(open, "id")
  if (id) return id
  return null
}

const SVG_RE = /<svg\b[\s\S]*?<\/svg>/gi

export function extractInlineSvgs(text: string, path: string): ExtractedIcon[] {
  const out: ExtractedIcon[] = []
  const matches = text.match(SVG_RE)
  if (!matches) return out
  matches.forEach((rawSvg, i) => {
    const svg = cleanSvg(rawSvg)
    if (svg.length > 60_000) return // skip oversized blobs (often illustrations, not icons)
    const rawName = guessInlineName(svg) ?? `${baseName(path)}-${i + 1}`
    const { name, query } = normalizeName(rawName)
    out.push({
      id: `${path}#${i}`,
      name,
      rawName,
      query,
      path,
      svg,
      source: "inline",
    })
  })
  return out
}

export function extractFromFile(path: string, text: string): ExtractedIcon[] {
  if (isSvgFile(path)) {
    const start = text.search(/<svg\b/i)
    const end = text.toLowerCase().lastIndexOf("</svg>")
    if (start === -1 || end === -1) return []
    const svg = cleanSvg(text.slice(start, end + 6))
    const { name, query } = normalizeName(baseName(path))
    return [{ id: path, name, rawName: baseName(path), query, path, svg, source: "file" }]
  }
  return extractInlineSvgs(text, path)
}
