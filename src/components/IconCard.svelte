<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import type { ExtractedIcon } from "../lib/extract"

  export let icon: ExtractedIcon
  export let selected = false
  const dispatch = createEventDispatcher<{ select: void }>()
</script>

<button
  class="card"
  class:selected
  title={icon.path}
  on:click={() => dispatch("select")}
>
  <div class="preview">{@html icon.svg}</div>
  <div class="name">{icon.name}</div>
  <div class="src">{icon.source === "file" ? "file" : "inline"}</div>
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 10px 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    transition: border-color 0.15s, transform 0.1s, background 0.15s;
    position: relative;
    overflow: hidden;
  }
  .card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .card.selected {
    border-color: var(--accent);
    background: #1d2233;
  }
  .preview {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
  }
  .preview :global(svg) {
    width: 100%;
    height: 100%;
    max-width: 40px;
    max-height: 40px;
  }
  .name {
    font-size: 11px;
    color: var(--muted);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .src {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    opacity: 0.6;
  }
</style>
