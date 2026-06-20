<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { buildBatchPrompt, type IconChange } from "../lib/prompt"

  export let changes: IconChange[]
  const dispatch = createEventDispatcher<{ close: void; remove: { id: string }; clear: void }>()

  let copied = false
  $: prompt = buildBatchPrompt(changes)

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(prompt)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      copied = false
    }
  }
</script>

<div class="backdrop" on:click={() => dispatch("close")} role="presentation"></div>

<div class="drawer">
  <div class="top">
    <div class="title">Icon changes <span class="count">{changes.length}</span></div>
    <button class="close" on:click={() => dispatch("close")} aria-label="Close">×</button>
  </div>

  {#if !changes.length}
    <p class="empty">No changes queued yet. Pick a source icon, choose a replacement, then
      <b>Add to changes</b>.</p>
  {:else}
    <div class="list">
      {#each changes as c (c.id)}
        <div class="row">
          {#if c.kind === "add"}
            <div class="mini">{@html c.svg}</div>
            <div class="tag-new">NEW</div>
            <div class="meta">
              <div class="names">{c.name}.svg</div>
              <div class="path" title={c.destFolder}>{c.destFolder || "(repo root)"}</div>
            </div>
          {:else}
            <div class="mini">{@html c.source.svg}</div>
            <div class="arrow">→</div>
            <div class="mini light"><img src={c.replacement.previewUrl} alt={c.replacement.name} /></div>
            <div class="meta">
              <div class="names">{c.source.name} <span>→ {c.replacement.icon}</span></div>
              <div class="path" title={c.source.path.split('#')[0]}>{c.source.path.split('#')[0]}</div>
            </div>
          {/if}
          <button class="rm" on:click={() => dispatch("remove", { id: c.id })} aria-label="Remove">×</button>
        </div>
      {/each}
    </div>

    <div class="actions">
      <button class="primary" on:click={copyAll}>{copied ? "Copied!" : "Copy prompt for all " + changes.length + " changes"}</button>
      <button class="ghost" on:click={() => dispatch("clear")}>Clear all</button>
    </div>

    <textarea class="prompt" readonly rows="12" value={prompt}></textarea>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 40;
  }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 41;
    width: min(460px, 92vw);
    background: var(--panel); border-left: 1px solid var(--border);
    padding: 20px; overflow: auto;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
  }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .title { font-size: 16px; font-weight: 700; }
  .count { background: var(--accent); color: white; border-radius: 20px; padding: 1px 9px; font-size: 12px; margin-left: 6px; }
  .close { background: transparent; border: none; color: var(--muted); font-size: 24px; line-height: 1; }
  .close:hover { color: var(--text); }

  .empty { color: var(--muted); line-height: 1.6; }
  .empty b { color: var(--text); }

  .list { display: flex; flex-direction: column; gap: 8px; }
  .row {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px;
  }
  .mini {
    width: 32px; height: 32px; flex: none; color: var(--text);
    display: flex; align-items: center; justify-content: center;
  }
  .mini :global(svg), .mini img { width: 24px; height: 24px; }
  .arrow { color: var(--muted); flex: none; }
  .tag-new {
    flex: none; font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    color: var(--accent-2); border: 1px solid var(--accent-2); border-radius: 6px; padding: 1px 5px;
  }
  .meta { min-width: 0; flex: 1; }
  .names { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .names span { color: var(--accent-2); font-weight: 500; }
  .path { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm { background: transparent; border: none; color: var(--muted); font-size: 18px; flex: none; }
  .rm:hover { color: var(--danger); }

  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .primary {
    flex: 1; background: var(--accent); color: white; border: none;
    border-radius: 9px; padding: 11px 14px; font-weight: 700;
  }
  .ghost {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 9px; padding: 11px 14px;
  }
  .ghost:hover { color: var(--text); border-color: var(--danger); }
  .prompt {
    width: 100%; resize: vertical;
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 11px; line-height: 1.5; outline: none;
  }
  .prompt:focus { border-color: var(--accent); }
</style>
