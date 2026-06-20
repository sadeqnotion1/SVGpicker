// GitHub repo access: parse input, resolve branch, list the tree, fetch raw files.
// Uses the public GitHub REST API (CORS enabled). A token is optional but raises
// the unauthenticated rate limit (60/hr) to 5000/hr.

export interface RepoRef {
  owner: string
  repo: string
  ref?: string
  subPath?: string
}

export interface TreeEntry {
  path: string
  type: string
  size?: number
}

const API = "https://api.github.com"
const RAW = "https://raw.githubusercontent.com"

/** Accepts "owner/repo", "github.com/owner/repo", or a full tree URL. */
export function parseRepoInput(input: string): RepoRef | null {
  const s = input.trim()
  if (!s) return null

  const short = s.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  if (short && !/\s/.test(s)) {
    return { owner: short[1], repo: short[2] }
  }

  try {
    const href = s.startsWith("http") ? s : "https://" + s
    const url = new URL(href)
    if (!/(^|\.)github\.com$/i.test(url.hostname)) return null
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/, "")
    let ref: string | undefined
    let subPath: string | undefined
    if ((parts[2] === "tree" || parts[2] === "blob") && parts[3]) {
      ref = parts[3]
      subPath = parts.slice(4).join("/") || undefined
    }
    return { owner, repo, ref, subPath }
  } catch {
    return null
  }
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" }
  if (token) h.Authorization = "Bearer " + token
  return h
}

export async function getDefaultBranch(ref: RepoRef, token?: string): Promise<string> {
  if (ref.ref) return ref.ref
  const r = await fetch(API + "/repos/" + ref.owner + "/" + ref.repo, { headers: headers(token) })
  if (!r.ok) throw new Error(describeError(r.status, "repository lookup"))
  const data = await r.json()
  return data.default_branch ?? "main"
}

export async function getTree(ref: RepoRef, branch: string, token?: string): Promise<TreeEntry[]> {
  const url =
    API + "/repos/" + ref.owner + "/" + ref.repo +
    "/git/trees/" + encodeURIComponent(branch) + "?recursive=1"
  const r = await fetch(url, { headers: headers(token) })
  if (!r.ok) throw new Error(describeError(r.status, "file tree"))
  const data = await r.json()
  const tree: TreeEntry[] = (data.tree ?? []).filter((e: TreeEntry) => e.type === "blob")
  return tree
}

export function rawUrl(ref: RepoRef, branch: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  return RAW + "/" + ref.owner + "/" + ref.repo + "/" + branch + "/" + encoded
}

export async function fetchText(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error("fetch failed (" + r.status + ")")
  return r.text()
}

function describeError(status: number, what: string): string {
  if (status === 404) return "Could not find that " + what + ". Check the owner/repo and that it is public."
  if (status === 403) return "GitHub rate limit hit during " + what + ". Add a personal access token to continue."
  if (status === 401) return "GitHub rejected the token while loading the " + what + "."
  return "GitHub " + what + " request failed (" + status + ")."
}
