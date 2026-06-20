<script lang="ts">
  import { parseRepoInput } from "./lib/github"
  import { scanRepo, type ScanProgress } from "./lib/scan"
  import type { ExtractedIcon } from "./lib/extract"
  import IconCard from "./components/IconCard.svelte"
  import SimilarPanel from "./components/SimilarPanel.svelte"

  let repoInput = ""
  let token = ""
  let scanning = false
  let error = ""
  let progress: ScanProgress = { total: 0, done: 0, found: 0 }
  let icons: ExtractedIcon[] = []
  let filter = ""
  let selected: ExtractedIcon | null = null

  const samples = ["tabler/tabler-icons", "lucide-icons/lucide", "twbs/icons"]

  $: filtered = filter
    ? icons.filter((i) => (i.name + " " + i.path).toLowerCase().includes(filter.toLowerCase()))
    : icons

  $: pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  async function scan() {
    error = ""
    selected = null
    icons = []
    filter = ""
    const ref = parseRepoInput(repoInput)
    if (!ref) {
      error = "Enter a GitHub repo like owner/repo or a github.com URL."
      return
    }
    scanning = true
    progress = { total: 0, done: 0, found: 0 }
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
</script>

<main>
  <header>
    <div class="brand">
      <span class="logo">◆</span> SVGpicker
    </div>
    <p class="tag">
      Pull icons out of any GitHub repo, then find similar icons from
      <b>Tabler</b>, <b>Lucide</b>, <b>Font Awesome</b> &amp; <b>Material Symbols</b>.
    </p>
  </header>

  <section class="controls">
    <input
      class="repo"
      bind:value={repoInput}
      placeholder="owner/repo  or  https://github.com/owner/repo"
      on:keydown={(e) => e.key === "Enter" && scan()}
    />
    <input
      class="token"
      type="password"
      bind:value={token}
      placeholder="GitHub token (optional)"
    />
    <button class="scan" on:click={scan} disabled={scanning}>
      {scanning ? "Scanning…" : "Scan repo"}
    </button>
  </section>

  <div class="samples">
    Try:
    {#each samples as s}
      <button class="chip" on:click={() => { repoInput = s; scan() }}>{s}</button>
    {/each}
  </div>

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
        <SimilarPanel icon={selected} on:close={() => (selected = null)} />
      </aside>
    {/if}
  </div>

  {#if !scanning && !icons.length && !error}
    <div class="empty">
      <p>Point SVGpicker at a repository to pull every <code>&lt;svg&gt;</code> it can find —
      both standalone <code>.svg</code> files and inline markup in components.</p>
      <p>Then click any extracted icon to browse matching icons across the four libraries
      and copy the one you want.</p>
    </div>
  {/if}

  <footer>Icons matched via the Iconify API. SVGpicker runs entirely in your browser.</footer>
</main>

<style>
  main {
    max-width: 1180px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }
  header { margin-bottom: 22px; }
  .brand {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    color: var(--accent);
    filter: drop-shadow(0 0 10px rgba(124, 92, 255, 0.6));
  }
  .tag { color: var(--muted); margin: 6px 0 0; max-width: 640px; line-height: 1.5; }
  .tag b { color: var(--text); font-weight: 600; }

  .controls { display: flex; gap: 10px; flex-wrap: wrap; }
  .repo, .token {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 10px;
    padding: 11px 14px;
    outline: none;
  }
  .repo { flex: 1; min-width: 260px; }
  .token { width: 200px; }
  .repo:focus, .token:focus { border-color: var(--accent); }
  .scan {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 0 22px;
    font-weight: 700;
  }
  .scan:disabled { opacity: 0.6; cursor: default; }

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
  .hint { color: var(--muted); font-size: 13px; }

  .layout { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
  .layout.split { grid-template-columns: minmax(0, 1fr) 380px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 12px;
  }
  .panel {
    position: sticky;
    top: 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    max-height: calc(100vh - 32px);
    overflow: auto;
  }

  .empty { margin-top: 30px; color: var(--muted); line-height: 1.6; max-width: 620px; }
  .empty code { background: var(--bg-2); padding: 1px 6px; border-radius: 6px; color: var(--text); }

  footer { margin-top: 48px; color: var(--muted); font-size: 12px; text-align: center; }

  @media (max-width: 820px) {
    .layout.split { grid-template-columns: 1fr; }
    .panel { position: static; max-height: none; }
  }
</style>
