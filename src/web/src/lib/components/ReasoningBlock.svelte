<script lang="ts">
  interface Props {
    content: string;
  }
  let { content }: Props = $props();
  let expanded = $state(false);
</script>

<div class="rounded-md border bg-muted/50 p-3">
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center gap-2 text-xs text-muted-foreground"
  >
    <span class="font-medium">Reasoning</span>
    <span>{expanded ? "hide" : "show"}</span>
  </button>
  {#if expanded}
    <div class="mt-2 text-sm text-muted-foreground">
      <p class="whitespace-pre-wrap">{content}</p>
    </div>
  {/if}
</div>
