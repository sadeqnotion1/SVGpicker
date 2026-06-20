// Quick sanity tests for the pure logic (no network). Run: npx tsx test/extract.test.ts
import assert from "node:assert/strict"
import {
  normalizeName,
  extractInlineSvgs,
  extractFromFile,
  shouldScan,
  isSvgFile,
  type ExtractedIcon,
} from "../src/lib/extract"
import { parseRepoInput } from "../src/lib/github"
import { buildSinglePrompt, buildBatchPrompt, type IconChange } from "../src/lib/prompt"
import { fitSvgToOriginal, readSvgBox } from "../src/lib/svgsize"
import type { IconMatch } from "../src/lib/iconify"

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log("  ok -", name)
}

test("normalizeName strips noise + splits camelCase", () => {
  assert.equal(normalizeName("ArrowLeftCircle").query, "arrow left circle")
  assert.equal(normalizeName("ic_home_24dp.svg").query, "home")
  assert.equal(normalizeName("icon-user-outline").query, "user")
})

test("parseRepoInput handles shorthand + urls", () => {
  assert.deepEqual(parseRepoInput("tabler/tabler-icons"), { owner: "tabler", repo: "tabler-icons" })
  const u = parseRepoInput("https://github.com/sadeqnotion1/SVGpicker/")
  assert.equal(u?.owner, "sadeqnotion1")
  assert.equal(u?.repo, "SVGpicker")
  const t = parseRepoInput("https://github.com/lucide-icons/lucide/tree/main/icons")
  assert.equal(t?.ref, "main")
  assert.equal(t?.subPath, "icons")
  assert.equal(parseRepoInput(""), null)
})

test("shouldScan respects extensions + skip dirs", () => {
  assert.equal(shouldScan("src/Icon.svelte"), true)
  assert.equal(isSvgFile("assets/home.svg"), true)
  assert.equal(shouldScan("node_modules/x/a.svg"), false)
  assert.equal(shouldScan("readme.txt"), false)
})

test("extractInlineSvgs finds inline markup + names", () => {
  const html = `<button><svg aria-label="search" viewBox="0 0 24 24"><path d="M1 1"/></svg></button>
    <i><svg class="icon icon-trash" viewBox="0 0 24 24"><path d="M2 2"/></svg></i>`
  const icons = extractInlineSvgs(html, "src/Toolbar.svelte")
  assert.equal(icons.length, 2)
  assert.equal(icons[0].query, "search")
  assert.equal(icons[1].query, "trash")
})

test("extractFromFile reads a standalone svg file", () => {
  const svg = `<?xml version="1.0"?><svg viewBox="0 0 24 24"><path d="M3 3"/></svg>`
  const icons = extractFromFile("icons/settings-gear.svg", svg)
  assert.equal(icons.length, 1)
  assert.equal(icons[0].source, "file")
  assert.equal(icons[0].query, "settings gear")
  assert.ok(!icons[0].svg.includes("<?xml"))
})

function fakeChange(path: string, name: string, icon: string): IconChange {
  const source: ExtractedIcon = {
    id: path, name, rawName: name, query: name, path, svg: "<svg><path d='M1 1'/></svg>", source: "file",
  }
  const replacement: IconMatch = {
    icon, prefix: icon.split(":")[0], name: icon.split(":")[1], library: "Tabler",
    svgUrl: "https://api.iconify.design/" + icon.replace(":", "/") + ".svg", previewUrl: "x",
  }
  return { kind: "replace", id: path, source, replacement, replacementSvg: "<svg><path d='M2 2'/></svg>" }
}

test("buildSinglePrompt includes path + old/new svg", () => {
  const p = buildSinglePrompt(fakeChange("icons/home.svg", "home", "tabler:home"))
  assert.ok(p.includes("File: icons/home.svg"))
  assert.ok(p.includes("tabler:home"))
  assert.ok(p.includes("OLD SVG"))
  assert.ok(p.includes("NEW SVG"))
})

test("buildBatchPrompt enumerates every change", () => {
  const p = buildBatchPrompt([
    fakeChange("a/home.svg", "home", "tabler:home"),
    fakeChange("b/user.svg", "user", "lucide:user"),
  ])
  assert.ok(p.includes("ALL 2 icon changes"))
  assert.ok(p.includes("=== Change 1 (replace icon) ==="))
  assert.ok(p.includes("=== Change 2 (replace icon) ==="))
  assert.ok(p.includes("a/home.svg"))
  assert.ok(p.includes("b/user.svg"))
  assert.equal(buildBatchPrompt([]), "")
})

test("buildBatchPrompt handles add (new icon) changes", () => {
  const add: IconChange = {
    kind: "add",
    id: "add:1",
    name: "my-logo",
    fileName: "My Logo.svg",
    svg: "<svg><path d='M9 9'/></svg>",
    destFolder: "src/assets/icons",
  }
  const p = buildBatchPrompt([add, fakeChange("a/home.svg", "home", "tabler:home")])
  assert.ok(p.includes("1 replacement and 1 addition"))
  assert.ok(p.includes("Create a new file: src/assets/icons/my-logo.svg"))
  assert.ok(p.includes("FILE CONTENTS:"))
})

test("fitSvgToOriginal adopts original outer size, keeps new viewBox", () => {
  const oldSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler" width="24" height="24" viewBox="0 0 24 24" stroke-width="2"><path d="M4 4"/></svg>`
  const newSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><path d="M1 1"/></svg>`
  const out = fitSvgToOriginal(newSvg, oldSvg)
  // keeps the new art's coordinate system
  assert.ok(out.includes('viewBox="0 0 512 512"'))
  // adopts the original's rendered footprint + class
  assert.ok(out.includes('width="24"'))
  assert.ok(out.includes('height="24"'))
  assert.ok(out.includes('class="icon icon-tabler"'))
  // inner art is preserved untouched
  assert.ok(out.includes('<path d="M1 1"/>'))
})

test("fitSvgToOriginal falls back to 1em when original is CSS-sized", () => {
  const oldSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="i" viewBox="0 0 24 24"><path/></svg>`
  const newSvg = `<svg viewBox="0 0 16 16"><path d="M2 2"/></svg>`
  const out = fitSvgToOriginal(newSvg, oldSvg)
  assert.ok(out.includes('width="1em"'))
  assert.ok(out.includes('height="1em"'))
  assert.ok(out.includes('viewBox="0 0 16 16"'))
  assert.ok(out.includes('class="i"'))
})

test("readSvgBox reads size attributes", () => {
  const b = readSvgBox(`<svg width="32" height="32" viewBox="0 0 32 32"><path/></svg>`)
  assert.equal(b.width, "32")
  assert.equal(b.height, "32")
  assert.equal(b.viewBox, "0 0 32 32")
  assert.equal(b.hasViewBox, true)
})

console.log(`\nAll ${passed} test groups passed.`)
