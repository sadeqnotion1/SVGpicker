// Builds copy-paste instructions for an AI coding terminal (Cursor, Claude Code, etc.).
// Used for a single icon swap and for a combined batch of swaps.

import type { ExtractedIcon } from "./extract"
import type { IconMatch } from "./iconify"

export interface IconChange {
  id: string // = source icon id (one queued change per source icon)
  source: ExtractedIcon
  replacement: IconMatch
  replacementSvg: string
}

const RULES =
  "Preserve each original element's attributes (class, width, height, aria-label, and " +
  "color/currentColor) so sizing and theming stay identical. Make a backup before editing " +
  "and keep changes minimal/additive."

function sourceKind(src: ExtractedIcon): string {
  return src.source === "file"
    ? "standalone .svg file — replace the entire file contents"
    : "inline <svg> in the file — replace just that element"
}

export function buildChangeSection(c: IconChange, index?: number): string {
  const file = c.source.path.split("#")[0]
  const newSvg = c.replacementSvg || "(fetch from " + c.replacement.svgUrl + ")"
  const header = index ? "=== Change " + index + " ===" : "Replace an icon in my project."
  return [
    header,
    "File: " + file,
    'Old icon: "' + c.source.name + '"  (' + sourceKind(c.source) + ")",
    "New icon: " + c.replacement.icon + "  (" + c.replacement.library + ")",
    "",
    "OLD SVG (find this):",
    c.source.svg,
    "",
    "NEW SVG (" + c.replacement.icon + "):",
    newSvg,
  ].join("\n")
}

export function buildSinglePrompt(c: IconChange): string {
  return buildChangeSection(c) + "\n\n" + RULES
}

export function buildBatchPrompt(changes: IconChange[]): string {
  if (!changes.length) return ""
  const intro =
    "Replace multiple icons in my project. Apply ALL " + changes.length + " changes below.\n" +
    "For each change, find the OLD SVG in the given file and replace it with the NEW SVG. " + RULES
  const sections = changes.map((c, i) => buildChangeSection(c, i + 1))
  return [intro, "", ...sections].join("\n\n")
}
