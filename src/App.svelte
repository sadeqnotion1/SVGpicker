<script lang="ts">
  import { parseRepoInput } from "./lib/github"
  import { scanRepo, type ScanProgress } from "./lib/scan"
  import { scanFiles } from "./lib/local"
  import { cleanSvg, normalizeName, type ExtractedIcon } from "./lib/extract"
  import type { IconChange } from "./lib/prompt"
  import type { IconMatch } from "./lib/iconify"
  import IconCard from "./components/IconCard.svelte"
  import SimilarPanel from "./components/SimilarPanel.svelte"
  import ChangesPanel from "./components/ChangesPanel.svelte"

  type Mode = "github" | "folder" | "add"
  let mode: Mode = "github"

  interface ImportItem {
    id: string
    fileName: string
    svg: string
    name: string
  }

  let repoInput = ""
  let token = ""
  let scanning = false
  let error = ""
  let progress: ScanProgress = { total: 0, done: 0, found: 0 }
  let icons: ExtractedIcon[] = []
  let filter = ""
  let selected: ExtractedIcon | null = null
  let sourceLabel = ""

  let changes: IconChange[] = []
  let showChanges = false
  let importItems: ImportItem[] = []
  let destFolder = "src/assets/icons"

  const samples = ["tabler/tabler-icons", "lucide-icons/lucide", "twbs/icons"]

  $: filtered = filter
    ? icons.filter((i) => (i.name + " " + i.path).toLowerCase().includes(filter.toLowerCase()))
    : icons
  $: pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  $: queuedIcon = (() => {
    const selId = selected?.id
    if (!selId) return null
    const c = changes.find((x) => x.id === selId)
    return c && c.kind === "replace" ? c.replacement.icon : null
  })()

  function reset() {
    error = ""
    selected = null
    icons = []
    filter = ""
    progress = { total: 0, done: 0, found: 0 }
  }

  async function scanGithub() {
    reset()
    const ref = parseRepoInput(repoInput)
    if (!ref) {
      error = "Enter a GitHub repo like owner/repo or a github.com URL."
      return
    }
    scanning = true
    sourceLabel = ref.owner + "/" + ref.repo
    try {
      icons = await scanRepo(ref, {
        token: token.trim() || undefined,
        onProgress: (p) => (progress = { ...p }),
      })
      if (!icons.length) error = "No SVG icons found in that repo."
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      scanning = false
    }
  }

  async function handleFolder(event: Event) {
    const input = event.target as HTMLInputElement
    const list = input.files
    if (!list || !list.length) return
    reset()
    scanning = true
    const files = Array.from(list)
    const first = files[0] as File & { webkitRelativePath?: string }
    sourceLabel = (first.webkitRelativePath?.split("/")[0] || "local folder") + "  (" + files.length + " files)"
    try {
      icons = await scanFiles(files, { onProgress: (p) => (progress = { ...p }) })
      if (!icons.length) error = "No SVG icons found in that folder."
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      scanning = false
      input.value = ""
    }
  }

  // "Add custom icons": import local .svg files you made, rename them, then add them
  // to the picker grid as source icons you can find similar matches for.
  async function handleImport(event: Event) {
    const input = event.target as HTMLInputElement
    const list = input.files
    if (!list || !list.length) return
    error = ""
    const svgFiles = Array.from(list).filter((f) => /\.svg$/i.test(f.name))
    if (!svgFiles.length) {
      error = "Pick one or more .svg files."
      input.value = ""
      return
    }
    const added: ImportItem[] = []
    for (const file of svgFiles) {
      try {
        const svg = cleanSvg(await file.text())
        if (!/<svg[\s\S]*<\/svg>/i.test(svg)) continue
        added.push({ id: crypto.randomUUID(), fileName: file.name, svg, name: defaultName(file.name) })
      } catch {
        // ignore unreadable file
      }
    }
    if (!added.length && !importItems.length) error = "Those files don't look like valid SVGs."
    importItems = [...importItems, ...added]
    input.value = ""
  }

  function defaultName(fileName: string): string {
    return (
      fileName
        .replace(/\.svg$/i, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "icon"
    )
  }

  function removeImport(id: string) {
    importItems = importItems.filter((i) => i.id !== id)
  }

  // Add the imported icons into the main grid as source icons (deduped by id),
  // so they become pickable like anything scanned from a repo/folder.
  function addToPicker() {
    const valid = importItems.filter((i) => i.name.trim())
    if (!valid.length) return
    const folder = destFolder.trim().replace(/^\/+|\/+$/g, "")
    const map = new Map(icons.map((i) => [i.id, i]))
    for (const i of valid) {
      const safe = i.name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "icon"
      const id = "custom:" + i.id
      const { query } = normalizeName(safe)
      const icon: ExtractedIcon = {
        id,
        name: safe,
        rawName: i.fileName,
        query: query || safe,
        path: (folder ? folder + "/" : "") + safe + ".svg",
        svg: i.svg,
        source: "file",
      }
      map.set(id, icon)
    }
    icons = [...map.values()]
    importItems = []
    error = ""
    if (!sourceLabel) sourceLabel = "Custom icons"
  }

  // Make a file input pick a whole directory (browser-only attribute).
  function asDirectory(node: HTMLInputElement) {
    ;(node as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true
  }

  function addChange(event: CustomEvent<{ replacement: IconMatch; svg: string }>) {
    if (!selected) return
    const { replacement, svg } = event.detail
    const item: IconChange = {
      kind: "replace",
      id: selected.id,
      source: selected,
      replacement,
      replacementSvg: svg,
    }
    const idx = changes.findIndex((c) => c.id === item.id)
    if (idx >= 0) {
      changes[idx] = item
      changes = [...changes]
    } else {
      changes = [...changes, item]
    }
  }

  function removeChange(event: CustomEvent<{ id: string }>) {
    changes = changes.filter((c) => c.id !== event.detail.id)
    if (!changes.length) showChanges = false
  }
  function clearChanges() {
    changes = []
    showChanges = false
  }
</script>

<main>
  <header>
    <div class="topbar">
      <div class="brand"><span class="logo">◆</span> SVGpicker</div>
      <button class="changes-btn" class:has={changes.length} on:click={() => (showChanges = true)}>
        Changes <span class="badge">{changes.length}</span>
      </button>
    </div>
    <p class="tag">
      Pull icons out of a GitHub repo or a local folder, then find similar icons from
      <b>Tabler</b>, <b>Lucide</b>, <b>Font Awesome</b> &amp; <b>Material Symbols</b>.
    </p>
  </header>

  <div class="tabs">
    <button class:active={mode === "github"} on:click={() => (mode = "github")}>GitHub repo</button>
    <button class:active={mode === "folder"} on:click={() => (mode = "folder")}>Local folder</button>
    <button class:active={mode === "add"} on:click={() => (mode = "add")}>Add custom icons</button>
  </div>

  {#if mode === "github"}
    <section class="controls">
      <input
        class="repo"
        bind:value={repoInput}
        placeholder="owner/repo  or  https://github.com/owner/repo"
        on:keydown={(e) => e.key === "Enter" && scanGithub()}
      />
      <input class="token" type="password" bind:value={token} placeholder="GitHub token (optional)" />
      <button class="scan" on:click={scanGithub} disabled={scanning}>
        {scanning ? "Scanning…" : "Scan repo"}
      </button>
    </section>
    <div class="samples">
      Try:
      {#each samples as s}
        <button class="chip" on:click={() => { repoInput = s; scanGithub() }}>{s}</button>
      {/each}
    </div>
  {:else if mode === "folder"}
    <section class="controls">
      <label class="filebtn">
        {scanning ? "Scanning…" : "Choose a folder…"}
        <input type="file" multiple use:asDirectory on:change={handleFolder} hidden />
      </label>
      <span class="file-hint">Scans every .svg file and inline &lt;svg&gt; in the folder — stays on your machine.</span>
    </section>
  {:else}
    <section class="controls add-controls">
      <label class="filebtn">
        Choose .svg file(s)…
        <input type="file" accept=".svg,image/svg+xml" multiple on:change={handleImport} hidden />
      </label>
      <label class="dest">
        <span>Folder label (optional)</span>
        <input bind:value={destFolder} placeholder="src/assets/icons" />
      </label>
    </section>
    <p class="file-hint big">Import icons you made yourself, rename them, then add them to the picker — they join the grid as source icons you can find similar matches for. Nothing leaves your browser.</p>

    {#if importItems.length}
      <div class="import-list">
        {#each importItems as item (item.id)}
          <div class="import-row">
            <div class="mini">{@html item.svg}</div>
            <input class="name-in" bind:value={item.name} spellcheck="false" />
            <span class="ext">.svg</span>
            <span class="orig" title={item.fileName}>{item.fileName}</span>
            <button class="rm" on:click={() => removeImport(item.id)} aria-label="Remove">×</button>
          </div>
        {/each}
        <div class="import-actions">
          <button class="primary" on:click={addToPicker}>Add {importItems.length} icon{importItems.length > 1 ? "s" : ""} to picker</button>
          <button class="ghost" on:click={() => (importItems = [])}>Clear</button>
        </div>
      </div>
    {/if}
  {/if}

  {#if scanning}
    <div class="progress">
      <div class="bar"><div class="fill" style="width:{pct}%"></div></div>
      <span class="pmeta">
        {progress.done}/{progress.total} files · {progress.found} icons
        {#if progress.current}· <span class="cur">{progress.current}</span>{/if}
      </span>
    </div>
  {/if}

  {#if error}<div class="error">{error}</div>{/if}

  {#if icons.length}
    <div class="toolbar">
      <input class="filter" bind:value={filter} placeholder={"Filter " + icons.length + " icons…"} />
      {#if sourceLabel}<span class="src-tag">{sourceLabel}</span>{/if}
      <span class="hint">Click an icon to find similar ones →</span>
    </div>
  {/if}

  <div class="layout" class:split={selected}>
    <div class="grid">
      {#each filtered as icon (icon.id)}
        <IconCard {icon} selected={selected?.id === icon.id} on:select={() => (selected = icon)} />
      {/each}
    </div>

    {#if selected}
      <aside class="panel">
        <SimilarPanel
          icon={selected}
          {queuedIcon}
          on:close={() => (selected = null)}
          on:add={addChange}
        />
      </aside>
    {/if}
  </div>

  {#if !scanning && !icons.length && !error && mode !== "add"}
    <div class="empty">
      <p>Point SVGpicker at a <b>GitHub repo</b> or a <b>local folder</b> to pull every
      <code>&lt;svg&gt;</code> it can find — both standalone <code>.svg</code> files and inline markup.</p>
      <p>Click an extracted icon to browse matching icons across the four libraries, then
      <b>Add to changes</b> and export one prompt for all your swaps.</p>
    </div>
  {/if}

  <footer>Icons matched via the Iconify API. SVGpicker runs entirely in your browser.</footer>
</main>

{#if showChanges}
  <ChangesPanel
    {changes}
    on:close={() => (showChanges = false)}
    on:remove={removeChange}
    on:clear={clearChanges}
  />
{/if}

<style>
  main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 64px; }
  header { margin-bottom: 18px; }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand {
    font-size: 26px; font-weight: 800; letter-spacing: -0.01em;
    display: flex; align-items: center; gap: 10px;
  }
  .logo { color: var(--accent); filter: drop-shadow(0 0 10px rgba(124, 92, 255, 0.6)); }
  .changes-btn {
    background: var(--bg-2); color: var(--text); border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 14px; font-weight: 600;
  }
  .changes-btn.has { border-color: var(--accent-2); }
  .changes-btn:hover { border-color: var(--accent); }
  .badge {
    background: var(--accent); color: white; border-radius: 20px; padding: 0 8px;
    font-size: 12px; margin-left: 4px;
  }
  .tag { color: var(--muted); margin: 6px 0 0; max-width: 660px; line-height: 1.5; }
  .tag b { color: var(--text); font-weight: 600; }

  .tabs { display: flex; gap: 6px; margin: 18px 0 14px; flex-wrap: wrap; }
  .tabs button {
    background: var(--bg-2); color: var(--muted); border: 1px solid var(--border);
    border-radius: 9px; padding: 8px 14px; font-weight: 600; font-size: 13px;
  }
  .tabs button.active { color: var(--text); border-color: var(--accent); background: #1d2233; }

  .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .repo, .token {
    background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 11px 14px; outline: none;
  }
  .repo { flex: 1; min-width: 260px; }
  .token { width: 200px; }
  .repo:focus, .token:focus { border-color: var(--accent); }
  .scan {
    background: var(--accent); color: white; border: none;
    border-radius: 10px; padding: 0 22px; font-weight: 700;
  }
  .scan:disabled { opacity: 0.6; cursor: default; }

  .filebtn {
    display: inline-flex; align-items: center; cursor: pointer;
    background: var(--accent); color: white; border-radius: 10px;
    padding: 11px 20px; font-weight: 700;
  }
  .filebtn:hover { filter: brightness(1.08); }
  .file-hint { color: var(--muted); font-size: 13px; }

  .samples { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; color: var(--muted); font-size: 13px; }
  .chip {
    background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
    border-radius: 20px; padding: 4px 12px; font-size: 12px;
  }
  .chip:hover { border-color: var(--accent); }

  .progress { margin-top: 18px; }
  .bar { height: 6px; background: var(--bg-2); border-radius: 6px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width 0.2s; }
  .pmeta { display: block; margin-top: 6px; font-size: 12px; color: var(--muted); }
  .cur { opacity: 0.8; }

  .error {
    margin-top: 18px; padding: 12px 14px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.35);
    color: #ffb3b3; border-radius: 10px; font-size: 14px;
  }

  .toolbar { display: flex; align-items: center; gap: 14px; margin: 22px 0 14px; flex-wrap: wrap; }
  .filter {
    background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 9px 14px; outline: none; min-width: 220px;
  }
  .filter:focus { border-color: var(--accent); }
  .src-tag {
    background: var(--bg-2); border: 1px solid var(--border); color: var(--muted);
    border-radius: 20px; padding: 4px 12px; font-size: 12px;
  }
  .hint { color: var(--muted); font-size: 13px; }

  .layout { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
  .layout.split { grid-template-columns: minmax(0, 1fr) 380px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
  .panel {
    position: sticky; top: 16px;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px;
    max-height: calc(100vh - 32px); overflow: auto;
  }

  .empty { margin-top: 30px; color: var(--muted); line-height: 1.6; max-width: 640px; }
  .empty b { color: var(--text); }
  .empty code { background: var(--bg-2); padding: 1px 6px; border-radius: 6px; color: var(--text); }

  footer { margin-top: 48px; color: var(--muted); font-size: 12px; text-align: center; }

  .add-controls { align-items: flex-end; }
  .dest { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--muted); }
  .dest input {
    background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
    border-radius: 10px; padding: 11px 14px; outline: none; min-width: 240px;
  }
  .dest input:focus { border-color: var(--accent); }
  .file-hint.big { margin-top: 12px; display: block; }

  .import-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
  .import-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px;
  }
  .import-row .mini {
    width: 34px; height: 34px; flex: none; color: var(--text);
    display: flex; align-items: center; justify-content: center;
  }
  .import-row .mini :global(svg) { width: 26px; height: 26px; }
  .name-in {
    flex: 1; min-width: 120px;
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 8px 10px; outline: none;
  }
  .name-in:focus { border-color: var(--accent); }
  .ext { color: var(--muted); font-size: 13px; }
  .orig { color: var(--muted); font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .import-row .rm { background: transparent; border: none; color: var(--muted); font-size: 18px; flex: none; }
  .import-row .rm:hover { color: var(--danger); }
  .import-actions { display: flex; gap: 8px; margin-top: 6px; }
  .import-actions .primary {
    background: var(--accent-2); color: #04130f; border: none;
    border-radius: 9px; padding: 10px 16px; font-weight: 700;
  }
  .import-actions .ghost {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 9px; padding: 10px 16px;
  }

  @media (max-width: 820px) {
    .layout.split { grid-template-columns: 1fr; }
    .panel { position: static; max-height: none; }
  }
</style>
