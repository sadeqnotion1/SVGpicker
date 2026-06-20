// Scan icons from files chosen on the local machine — either a whole folder
// (<input webkitdirectory>) or individual files. Reuses the same extraction logic
// as the GitHub scanner, so .svg files and inline <svg> markup are both supported.

import { extractFromFile, shouldScan, isSvgFile, type ExtractedIcon } from "./extract"
import type { ScanProgress } from "./scan"

export function relPath(f: File): string {
  const anyFile = f as File & { webkitRelativePath?: string }
  return anyFile.webkitRelativePath || f.name
}

export interface LocalScanOptions {
  onProgress?: (p: ScanProgress) => void
  maxFiles?: number
}

export async function scanFiles(files: File[], opts: LocalScanOptions = {}): Promise<ExtractedIcon[]> {
  const { onProgress, maxFiles = 2000 } = opts

  let candidates = files.filter((f) => shouldScan(relPath(f)))
  // Dedicated .svg files first — cleanest icon sources.
  candidates.sort((a, b) => Number(isSvgFile(relPath(b))) - Number(isSvgFile(relPath(a))))
  if (candidates.length > maxFiles) candidates = candidates.slice(0, maxFiles)

  const total = candidates.length
  let done = 0
  const all: ExtractedIcon[] = []
  const seen = new Set<string>()

  onProgress?.({ total, done, found: 0 })

  for (const file of candidates) {
    const path = relPath(file)
    try {
      const text = await file.text()
      for (const icon of extractFromFile(path, text)) {
        const key = icon.svg.replace(/\s+/g, "")
        if (key.length < 20 || seen.has(key)) continue
        seen.add(key)
        all.push(icon)
      }
    } catch {
      // Ignore unreadable files; keep going.
    }
    done++
    onProgress?.({ total, done, found: all.length, current: path })
  }

  return all
}
