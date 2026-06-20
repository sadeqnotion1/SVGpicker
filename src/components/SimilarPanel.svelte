<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { searchSimilar, fetchIconSvg, type IconMatch } from "../lib/iconify"
  import type { ExtractedIcon } from "../lib/extract"
  import { fitSvgToOriginal, describeFit } from "../lib/svgsize"
  import { buildSinglePrompt } from "../lib/prompt"

  export let icon: ExtractedIcon
  export let customIcons: IconMatch[] = []
  export let queuedIcon: string | null = null
  const dispatch = createEventDispatcher<{
    close: void
    add: { replacement: IconMatch; svg: string }
  }>()

  let query = ""
  let loading = false
  let error = ""
  let matches: IconMatch[] = []
  let chosen: IconMatch | null = null
  let chosenSvg = ""
  let copied = ""
  let lastId = ""
  let fit = true

  // The SVG we actually hand off: matched to the original's footprint when
  // "Match original size" is on, otherwise the raw icon-set SVG.
  $: outSvg = chosenSvg ? (fit ? fitSvgToOriginal(chosenSvg, icon.svg) : chosenSvg) : ""
  $: fitNote = chosenSvg ? describeFit(chosenSvg, icon.svg) : ""

  $: if (icon && icon.id !== lastId) {
    lastId = icon.id
    query = icon.query
    run()
  }

  async function run() {
    loading = true
    error = ""
    matches = []
    chosen = null
    chosenSvg = ""
    try {
      matches = await searchSimilar(query)
      if (!matches.length) error = "No matches. Try a simpler search term."
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      loading = false
    }
  }

  // Your own icons always appear first as candidates, regardless of the search term.
  $: groups = [
    ...(customIcons.length ? [["My icons", customIcons] as [string, IconMatch[]]] : []),
    ...group(matches),
  ]
  function group(ms: IconMatch[]): Array<[string, IconMatch[]]> {
    const map = new Map<string, IconMatch[]>()
    for (const m of ms) {
      const arr = map.get(m.library) ?? []
      arr.push(m)
      map.set(m.library, arr)
    }
    return [...map.entries()]
  }

  async function choose(m: IconMatch) {
    chosen = m
    chosenSvg = ""
    if (m.custom && m.svg) {
      chosenSvg = m.svg
      return
    }
    try {
      chosenSvg = await fetchIconSvg(m.icon)
    } catch {
      chosenSvg = ""
    }
  }

  $: prompt =
    chosen
      ? buildSinglePrompt({
          kind: "replace",
          id: icon.id,
          source: icon,
          replacement: chosen,
          replacementSvg: outSvg,
        })
      : ""

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      copied = label
      setTimeout(() => (copied = ""), 1400)
    } catch {
      copied = ""
    }
  }
</script>

<div class="head">
  <div class="source">
    <div class="src-preview">{@html icon.svg}</div>
    <div class="src-meta">
      <div class="src-name">{icon.name}</div>
      <div class="src-path" title={icon.path}>{icon.path}</div>
    </div>
  </div>
  <button class="close" on:click={() => dispatch("close")} aria-label="Close">×</button>
</div>

<form class="search" on:submit|preventDefault={run}>
  <input bind:value={query} placeholder="Search similar icons…" />
  <button type="submit" disabled={loading}>{loading ? "…" : "Find"}</button>
</form>

{#if error}
  <div class="note">{error}</div>
{/if}

{#if chosen}
  <div class="chosen">
    <div class="chosen-preview">
      {#if outSvg}{@html outSvg}{:else}<img src={chosen.previewUrl} alt={chosen.name} />{/if}
    </div>
    <div class="chosen-body">
      <div class="chosen-name">{chosen.library} · {chosen.name}</div>
      <label class="fit-toggle" title="Keep the new icon's viewBox but reuse the original's width/height/class so it slots in at the same size.">
        <input type="checkbox" bind:checked={fit} />
        Match original size
      </label>
      {#if fit && fitNote}<div class="fit-note">{fitNote}</div>{/if}
      <div class="copy-row">
        <button on:click={() => chosen && copy(chosen.icon, "name")}>Copy name</button>
        <button on:click={() => outSvg && copy(outSvg, "svg")} disabled={!outSvg}>Copy SVG</button>
        <button on:click={() => chosen && copy(chosen.svgUrl, "url")} disabled={!chosen.svgUrl}>Copy URL</button>
      </div>
    </div>
  </div>

  <button
    class="add"
    class:done={queuedIcon === chosen.icon}
    on:click={() => chosen && dispatch("add", { replacement: chosen, svg: outSvg })}
  >
    {queuedIcon === chosen.icon ? "✓ In changes · update" : "+ Add to changes"}
  </button>

  <details class="export">
    <summary>Single-change prompt</summary>
    <p class="export-sub">Or queue several and export one combined prompt from <b>Changes</b>.</p>
    <textarea class="prompt" readonly rows="8" value={prompt}></textarea>
    <button class="copy-prompt" on:click={() => copy(prompt, "prompt")}>Copy this prompt</button>
  </details>
{/if}

{#if copied}<div class="copied">Copied {copied}!</div>{/if}

<div class="results">
  {#each groups as [library, items] (library)}
    <div class="group">
      <div class="group-title">{library} <span>{items.length}</span></div>
      <div class="icons">
        {#each items as m (m.icon)}
          <button
            class="micon"
            class:active={chosen?.icon === m.icon}
            title={m.custom ? m.name : m.icon}
            on:click={() => choose(m)}
          >
            {#if m.custom}{@html m.svg}{:else}<img src={m.previewUrl} alt={m.name} loading="lazy" />{/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .source { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .src-preview {
    width: 44px; height: 44px; flex: none;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-2); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text);
  }
  .src-preview :global(svg) { width: 28px; height: 28px; }
  .src-meta { min-width: 0; }
  .src-name { font-weight: 600; }
  .src-path {
    font-size: 11px; color: var(--muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;
  }
  .close {
    background: transparent; border: none; color: var(--muted);
    font-size: 22px; line-height: 1; padding: 2px 6px;
  }
  .close:hover { color: var(--text); }

  .search { display: flex; gap: 8px; margin: 16px 0 4px; }
  .search input {
    flex: 1; background: var(--bg-2); border: 1px solid var(--border);
    color: var(--text); border-radius: 8px; padding: 9px 12px; outline: none;
  }
  .search input:focus { border-color: var(--accent); }
  .search button {
    background: var(--accent); color: white; border: none;
    border-radius: 8px; padding: 0 16px; font-weight: 600;
  }

  .note { color: var(--muted); font-size: 13px; padding: 10px 2px; }

  .chosen {
    display: flex; gap: 12px; align-items: center;
    margin: 12px 0; padding: 12px;
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px;
  }
  .chosen-preview {
    width: 48px; height: 48px; flex: none; color: var(--text);
    display: flex; align-items: center; justify-content: center;
  }
  .chosen-preview :global(svg), .chosen-preview img { width: 36px; height: 36px; }
  .chosen-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .fit-toggle {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text); margin-bottom: 4px; cursor: pointer;
  }
  .fit-toggle input { accent-color: var(--accent); }
  .fit-note { font-size: 11px; color: var(--muted); margin-bottom: 8px; }
  .copy-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .copy-row button {
    background: #222840; color: var(--text); border: 1px solid var(--border);
    border-radius: 7px; padding: 5px 10px; font-size: 12px;
  }
  .copy-row button:hover:not(:disabled) { border-color: var(--accent); }
  .copy-row button:disabled { opacity: 0.4; cursor: default; }

  .add {
    width: 100%; margin-bottom: 12px;
    background: var(--accent-2); color: #04130f; border: none;
    border-radius: 9px; padding: 10px; font-weight: 700;
  }
  .add.done { background: #16241f; color: var(--accent-2); border: 1px solid var(--accent-2); }

  .export {
    margin: 0 0 12px; padding: 10px 12px;
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px;
  }
  .export summary { cursor: pointer; font-size: 13px; font-weight: 600; }
  .export-sub { margin: 8px 0; font-size: 12px; color: var(--muted); }
  .export-sub b { color: var(--text); }
  .prompt {
    width: 100%; resize: vertical;
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 11px; line-height: 1.5; outline: none;
  }
  .prompt:focus { border-color: var(--accent); }
  .copy-prompt {
    margin-top: 8px; background: var(--accent); color: white; border: none;
    border-radius: 7px; padding: 7px 12px; font-size: 12px; font-weight: 600;
  }

  .copied {
    position: sticky; bottom: 6px;
    text-align: center; font-size: 12px; color: var(--accent-2); margin: 8px 0;
  }

  .results { margin-top: 12px; display: flex; flex-direction: column; gap: 18px; }
  .group-title {
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted); margin-bottom: 8px;
  }
  .group-title span {
    background: var(--bg-2); border-radius: 20px; padding: 1px 8px;
    margin-left: 4px; font-size: 11px;
  }
  .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 8px; }
  .micon {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    background: var(--panel); border: 1px solid var(--border); border-radius: 9px;
    transition: border-color 0.12s, transform 0.1s;
  }
  .micon:hover { border-color: var(--accent); transform: translateY(-1px); }
  .micon.active { border-color: var(--accent-2); background: #16241f; }
  .micon { color: var(--text); }
  .micon img { width: 24px; height: 24px; }
  .micon :global(svg) { width: 24px; height: 24px; }
</style>
