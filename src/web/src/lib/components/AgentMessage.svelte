<script lang="ts">
  interface Props {
    content: string;
    streaming?: boolean;
  }
  let { content, streaming = false }: Props = $props();
</script>

<div class="flex justify-start">
  <div class="max-w-[80%] rounded-lg bg-muted px-4 py-2">
    <div class="prose prose-sm dark:prose-invert">
      {#if content}
        <p class="whitespace-pre-wrap text-sm">{content}</p>
      {/if}
      {#if streaming}
        <span class="inline-block h-4 w-1 animate-pulse bg-foreground"></span>
      {/if}
    </div>
  </div>
</div>
