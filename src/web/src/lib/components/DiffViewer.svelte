<script lang="ts">
  import type { FileDiff } from "@clawdex/shared-types";

  interface Props {
    diff: FileDiff;
  }
  let { diff }: Props = $props();
  let expanded = $state(true);

  // Monaco editor will be lazy-loaded in a future phase.
  // For now, show a simple text-based diff view.
</script>

<div class="rounded-md border bg-card">
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center justify-between p-3 text-sm"
  >
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs">{diff.path}</span>
      <span
        class="rounded px-1.5 py-0.5 text-xs font-medium"
        class:bg-green-100={diff.status === "added"}
        class:text-green-800={diff.status === "added"}
        class:bg-blue-100={diff.status === "modified"}
        class:text-blue-800={diff.status === "modified"}
        class:bg-red-100={diff.status === "deleted"}
        class:text-red-800={diff.status === "deleted"}
      >
        {diff.status}
      </span>
    </div>
    <span class="text-xs text-muted-foreground">{expanded ? "collapse" : "expand"}</span>
  </button>

  {#if expanded}
    <div class="border-t p-3">
      {#if diff.isBinary}
        <p class="text-sm text-muted-foreground">Binary file changed</p>
      {:else if diff.truncated}
        <p class="text-sm text-muted-foreground">Diff truncated (file too large)</p>
      {:else}
        <div class="grid grid-cols-2 gap-2">
          {#if diff.status !== "added"}
            <div>
              <p class="mb-1 text-xs font-medium text-red-500">Before</p>
              <pre class="max-h-60 overflow-auto rounded bg-red-50 p-2 text-xs dark:bg-red-950">{diff.before}</pre>
            </div>
          {/if}
          {#if diff.status !== "deleted"}
            <div>
              <p class="mb-1 text-xs font-medium text-green-500">After</p>
              <pre class="max-h-60 overflow-auto rounded bg-green-50 p-2 text-xs dark:bg-green-950">{diff.after}</pre>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
