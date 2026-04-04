<script lang="ts">
  import type { UIToolCall } from "../stores/messages.js";

  interface Props {
    toolCall: UIToolCall;
  }
  let { toolCall }: Props = $props();
  let expanded = $state(false);
</script>

<div class="rounded-md border bg-card p-3">
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center justify-between text-sm"
  >
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs font-medium">{toolCall.tool}</span>
      {#if toolCall.status === "running"}
        <span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></span>
      {:else if toolCall.success}
        <span class="text-green-500">done</span>
      {:else if toolCall.success === false}
        <span class="text-red-500">failed</span>
      {/if}
    </div>
    <span class="text-xs text-muted-foreground">{expanded ? "collapse" : "expand"}</span>
  </button>

  {#if expanded}
    <div class="mt-2 space-y-2">
      <div>
        <p class="text-xs font-medium text-muted-foreground">Arguments</p>
        <pre class="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(toolCall.args, null, 2)}</pre>
      </div>
      {#if toolCall.output !== undefined}
        <div>
          <p class="text-xs font-medium text-muted-foreground">Output</p>
          <pre class="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">{toolCall.output}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>
