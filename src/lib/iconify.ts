// Find similar icons via the Iconify public API, restricted to the four libraries
// the app targets. Iconify hosts all of them, so one search covers every set.
// Docs: https://iconify.design/docs/api/

export interface IconMatch {
  icon: string // e.g. "tabler:home"
  prefix: string
  name: string
  library: string
  svgUrl: string // plain (currentColor) — best for copying / embedding in your app
  previewUrl: string // light-colored — used only for display on the dark UI
  svg?: string // inline SVG for custom (non-Iconify) icons you imported
  custom?: boolean // true for your own imported icons
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
// Light color so currentColor-based icons stay visible on the dark UI.
const PREVIEW_COLOR = "#e6e9f0"

export function iconSvgUrl(icon: string, opts: { height?: number; color?: string } = {}): string {
  const { height = 40, color } = opts
  const [prefix, name] = icon.split(":")
  let url = BASE + "/" + prefix + "/" + name + ".svg?height=" + height
  if (color) url += "&color=" + encodeURIComponent(color)
  return url
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
    previewUrl: iconSvgUrl(icon, { color: PREVIEW_COLOR }),
  }
}

export async function searchSimilar(query: string, limit = 60): Promise<IconMatch[]> {
  const q = query.trim()
  if (!q) return []
  const url =
    BASE + "/search?query=" + encodeURIComponent(q) +
    "&limit=" + limit + "&prefixes=" + PREFIXES.join(",")
  const r = await fetch(url)
  if (!r.ok) throw new Error("Icon search failed (" + r.status + ").")
  const data = await r.json()
  const icons: string[] = data.icons ?? []
  return icons.map(toMatch).filter((m): m is IconMatch => m !== null)
}

export async function fetchIconSvg(icon: string): Promise<string> {
  const [prefix, name] = icon.split(":")
  const r = await fetch(BASE + "/" + prefix + "/" + name + ".svg")
  if (!r.ok) throw new Error("Icon fetch failed (" + r.status + ").")
  return r.text()
}

// Build a replacement candidate from one of your own imported SVGs. It carries the
// inline svg (no Iconify URL) and is grouped under "My icons" in the similar-icons panel.
export function customMatch(name: string, svg: string): IconMatch {
  return {
    icon: "custom:" + name,
    prefix: "custom",
    name,
    library: "My icons",
    svgUrl: "",
    previewUrl: "",
    svg,
    custom: true,
  }
}
