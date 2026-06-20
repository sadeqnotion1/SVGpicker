// Find similar icons via the Iconify public API, restricted to the four libraries
// the app targets. Iconify hosts all of them, so one search covers every set.
// Docs: https://iconify.design/docs/api/

export interface IconMatch {
  icon: string // e.g. "tabler:home"
  prefix: string
  name: string
  library: string
  svgUrl: string
}

// Iconify prefix -> friendly library name. Order also defines display priority.
const LIBRARIES: Record<string, string> = {
  tabler: "Tabler",
  lucide: "Lucide",
  "fa6-solid": "Font Awesome",
  "fa6-regular": "Font Awesome",
  "fa6-brands": "Font Awesome",
  "material-symbols": "Material Symbols",
}

export const PREFIXES = Object.keys(LIBRARIES)
export const LIBRARY_NAMES = [...new Set(Object.values(LIBRARIES))]

const BASE = "https://api.iconify.design"

export function iconSvgUrl(icon: string, height = 40): string {
  const [prefix, name] = icon.split(":")
  return `${BASE}/${prefix}/${name}.svg?height=${height}`
}

function toMatch(icon: string): IconMatch | null {
  const [prefix, name] = icon.split(":")
  if (!prefix || !name) return null
  return {
    icon,
    prefix,
    name,
    library: LIBRARIES[prefix] ?? prefix,
    svgUrl: iconSvgUrl(icon),
  }
}

export async function searchSimilar(query: string, limit = 60): Promise<IconMatch[]> {
  const q = query.trim()
  if (!q) return []
  const url =
    `${BASE}/search?query=${encodeURIComponent(q)}` +
    `&limit=${limit}&prefixes=${PREFIXES.join(",")}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Icon search failed (${r.status}).`)
  const data = await r.json()
  const icons: string[] = data.icons ?? []
  return icons.map(toMatch).filter((m): m is IconMatch => m !== null)
}

export async function fetchIconSvg(icon: string): Promise<string> {
  const [prefix, name] = icon.split(":")
  const r = await fetch(`${BASE}/${prefix}/${name}.svg`)
  if (!r.ok) throw new Error(`Icon fetch failed (${r.status}).`)
  return r.text()
}
