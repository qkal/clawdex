<script lang="ts">
  import { messages, streamingDelta, isStreaming } from "../stores/messages.js";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";

  let scrollContainer: HTMLDivElement;

  // Auto-scroll on new messages
  $effect(() => {
    if ($messages.length || $streamingDelta) {
      scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
    }
  });
</script>

<div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-4">
  {#if $messages.length === 0 && !$isStreaming}
    <div class="flex h-full items-center justify-center">
      <p class="text-muted-foreground">Start a conversation...</p>
    </div>
  {:else}
    <div class="mx-auto max-w-3xl space-y-4">
      {#each $messages as msg (msg.id)}
        {#if msg.role === "user"}
          <UserMessage content={msg.content} />
        {:else if msg.role === "assistant"}
          <AgentMessage content={msg.content} streaming={msg.streaming} />
        {/if}
      {/each}
      {#if $isStreaming && $streamingDelta}
        <AgentMessage content={$streamingDelta} streaming={true} />
      {/if}
    </div>
  {/if}
</div>
