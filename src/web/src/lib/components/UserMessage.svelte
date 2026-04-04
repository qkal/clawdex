<script lang="ts">
  interface Props {
    content: string;
  }
  let { content }: Props = $props();
</script>

<div class="flex justify-end">
  <div class="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
    <p class="whitespace-pre-wrap text-sm">{content}</p>
  </div>
</div>
