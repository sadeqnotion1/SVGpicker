// Orchestrates a full repo scan: resolve branch -> list tree -> fetch candidate
// files (bounded concurrency) -> extract + de-duplicate icons, reporting progress.

import {
  getDefaultBranch,
  getTree,
  rawUrl,
  fetchText,
  type RepoRef,
} from "./github"
import { extractFromFile, shouldScan, isSvgFile, type ExtractedIcon } from "./extract"

export interface ScanProgress {
  total: number
  done: number
  found: number
  current?: string
}

export interface ScanOptions {
  token?: string
  onProgress?: (p: ScanProgress) => void
  maxFiles?: number
  concurrency?: number
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

export async function scanRepo(ref: RepoRef, opts: ScanOptions = {}): Promise<ExtractedIcon[]> {
  const { token, onProgress, maxFiles = 800, concurrency = 8 } = opts

  const branch = await getDefaultBranch(ref, token)
  let tree = await getTree(ref, branch, token)

  if (ref.subPath) {
    const prefix = ref.subPath.replace(/\/$/, "")
    tree = tree.filter((e) => e.path === prefix || e.path.startsWith(prefix + "/"))
  }

  let candidates = tree.filter((e) => shouldScan(e.path))
  // Prefer dedicated .svg files first; they are the cleanest icon sources.
  candidates.sort((a, b) => Number(isSvgFile(b.path)) - Number(isSvgFile(a.path)))
  if (candidates.length > maxFiles) candidates = candidates.slice(0, maxFiles)

  const total = candidates.length
  let done = 0
  const all: ExtractedIcon[] = []
  const seen = new Set<string>()

  onProgress?.({ total, done, found: 0 })

  await mapLimit(candidates, concurrency, async (entry) => {
    try {
      const text = await fetchText(rawUrl(ref, branch, entry.path))
      for (const icon of extractFromFile(entry.path, text)) {
        const key = icon.svg.replace(/\s+/g, "")
        if (key.length < 20 || seen.has(key)) continue
        seen.add(key)
        all.push(icon)
      }
    } catch {
      // Ignore individual file failures; keep scanning the rest.
    }
    done++
    onProgress?.({ total, done, found: all.length, current: entry.path })
  })

  return all
}
