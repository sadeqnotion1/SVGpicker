// Size normalization for icon swaps.
//
// Why this exists: icon sets use different intrinsic coordinate systems and
// outer sizes. Tabler/Lucide are 24x24 stroke icons; Font Awesome is often
// 0 0 512 512 fill icons; Material Symbols can be 0 0 48 48. If you drop a new
// SVG straight into code that expected the old one, it renders at the wrong
// size because it carries its own width/height (or none) instead of the box the
// surrounding markup assumed.
//
// The fix is NOT pixel arithmetic — the SVG `viewBox` already maps the artwork
// into whatever outer box you give it. So we keep the NEW icon's viewBox (its
// own coordinate system, so the art is never distorted) and transplant the
// ORIGINAL element's outer sizing hooks (width/height/class/style) onto it. The
// result slots into the same footprint the old icon occupied.

export interface SvgBox {
  width: string | null
  height: string | null
  viewBox: string | null
  hasViewBox: boolean
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g

function openTag(svg: string): string {
  return svg.match(/<svg\b[^>]*>/i)?.[0] ?? ""
}

function readAttrs(svg: string): Record<string, string> {
  const open = openTag(svg)
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(open))) attrs[m[1].toLowerCase()] = m[2]
  return attrs
}

/** Read the size-relevant attributes of an SVG string. */
export function readSvgBox(svg: string): SvgBox {
  const a = readAttrs(svg)
  return {
    width: a.width ?? null,
    height: a.height ?? null,
    viewBox: a.viewbox ?? null,
    hasViewBox: a.viewbox != null,
  }
}

/**
 * Return `newSvg` resized so it occupies the same box the original icon used.
 *
 * - Keeps the new icon's own `viewBox` (artwork is mapped, never stretched).
 * - Adopts the original's `width`/`height` when it had them; otherwise falls
 *   back to the new icon's own size, then to a 1em square so CSS can drive it.
 * - Carries the original's `class` and `style` so existing CSS size rules and
 *   color hooks keep applying.
 * - Preserves common a11y attributes from the original.
 *
 * Pure string transform; safe to run on init / whenever a swap is chosen.
 */
export function fitSvgToOriginal(newSvg: string, originalSvg: string): string {
  const open = openTag(newSvg)
  if (!open) return newSvg
  const n = readAttrs(newSvg)
  const o = readAttrs(originalSvg)

  const out: Record<string, string> = {}
  out.xmlns = n.xmlns || "http://www.w3.org/2000/svg"

  // 1) Keep the NEW icon's coordinate system (fall back to original's).
  const viewBox = n.viewbox ?? o.viewbox
  if (viewBox) out.viewBox = viewBox

  // 2) Adopt the ORIGINAL outer size; else the new icon's; else 1em (CSS-sized).
  const width = first(o.width, n.width)
  const height = first(o.height, n.height)
  out.width = width ?? "1em"
  out.height = height ?? "1em"

  // 3) Carry sizing/color hooks the surrounding code relied on.
  const cls = first(o.class, n.class)
  if (cls) out.class = cls
  const style = first(o.style, n.style)
  if (style) out.style = style

  // 4) Preserve a11y / misc hints from the original element.
  for (const k of ["role", "aria-hidden", "aria-label", "focusable"]) {
    if (o[k] != null) out[k] = o[k]
  }

  const attrStr = Object.entries(out)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ")
  return newSvg.replace(/<svg\b[^>]*>/i, `<svg ${attrStr}>`)
}

function first(...vals: Array<string | undefined>): string | null {
  for (const v of vals) if (v != null && v !== "") return v
  return null
}

/** Human-readable description of how the swap will be sized, for the UI. */
export function describeFit(newSvg: string, originalSvg: string): string {
  const o = readSvgBox(originalSvg)
  const n = readSvgBox(newSvg)
  const box = o.width && o.height ? `${o.width}×${o.height}` : o.viewBox ? `viewBox ${o.viewBox}` : "CSS / 1em"
  const vb = n.viewBox ?? o.viewBox ?? "none"
  return `Sized to original (${box}); viewBox ${vb} kept`
}
