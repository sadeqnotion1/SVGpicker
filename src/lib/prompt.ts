// Builds copy-paste instructions for an AI coding terminal (Cursor, Claude Code, etc.).
// Covers two kinds of change: replacing an existing icon, and adding a new (custom) icon.
// Works for a single change and for a combined batch.

import type { ExtractedIcon } from "./extract"
import type { IconMatch } from "./iconify"

export interface ReplaceChange {
  kind: "replace"
  id: string // = source icon id (one queued change per source icon)
  source: ExtractedIcon
  replacement: IconMatch
  replacementSvg: string
}

export interface AddChange {
  kind: "add"
  id: string
  name: string // icon name, no extension (editable by the user)
  fileName: string // original local filename
  svg: string
  destFolder: string // target folder in the repo
}

export type IconChange = ReplaceChange | AddChange

const RULES =
  "Preserve each original element's attributes (class, width, height, aria-label, and " +
  "color/currentColor) so sizing and theming stay identical. Make a backup before editing " +
  "and keep changes minimal/additive."

export function joinPath(folder: string, file: string): string {
  const f = (folder || "").replace(/^\/+|\/+$/g, "").trim()
  return f ? f + "/" + file : file
}

function sourceKind(src: ExtractedIcon): string {
  return src.source === "file"
    ? "standalone .svg file — replace the entire file contents"
    : "inline <svg> in the file — replace just that element"
}

export function buildChangeSection(c: IconChange, index?: number): string {
  if (c.kind === "add") {
    const path = joinPath(c.destFolder, c.name + ".svg")
    const header = index ? "=== Change " + index + " (add icon) ===" : "Add a new icon to my project."
    return [
      header,
      "Create a new file: " + path,
      c.fileName ? "(from my local file: " + c.fileName + ")" : "",
      "",
      "FILE CONTENTS:",
      c.svg,
    ]
      .filter((line) => line !== "")
      .join("\n")
  }

  const file = c.source.path.split("#")[0]
  const newSvg = c.replacementSvg || "(fetch from " + c.replacement.svgUrl + ")"
  const header = index ? "=== Change " + index + " (replace icon) ===" : "Replace an icon in my project."
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
  const adds = changes.filter((c) => c.kind === "add").length
  const replaces = changes.length - adds
  const summary =
    replaces && adds
      ? replaces + " replacement" + (replaces > 1 ? "s" : "") + " and " + adds + " addition" + (adds > 1 ? "s" : "")
      : adds
        ? adds + " new icon" + (adds > 1 ? "s" : "")
        : replaces + " replacement" + (replaces > 1 ? "s" : "")
  const intro =
    "Apply ALL " + changes.length + " icon changes below (" + summary + ").\n" +
    "For replacements, find the OLD SVG in the given file and swap in the NEW SVG. " +
    "For additions, create the new file with the given contents. " + RULES
  const sections = changes.map((c, i) => buildChangeSection(c, i + 1))
  return [intro, "", ...sections].join("\n\n")
}
