<script lang="ts">
  import { wsClient } from "../stores/connection.js";
  import { activeSessionId } from "../stores/session.js";
  import { isStreaming, messages } from "../stores/messages.js";
  import { selectedModel } from "../stores/ui.js";
  import type { Op } from "@clawdex/shared-types";

  let input = $state("");

  function send() {
    if (!input.trim() || !$activeSessionId) return;

    // Add user message to local store immediately
    messages.update((msgs) => [
      ...msgs,
      {
        id: `user-${Date.now()}`,
        role: "user" as const,
        content: input.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);

    $wsClient?.send({
      type: "user_turn",
      prompt: input.trim(),
      sessionId: $activeSessionId,
      model: $selectedModel,
    } as Op);

    input = "";
  }

  function interrupt() {
    $wsClient?.send({ type: "interrupt" } as Op);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ($isStreaming) {
        interrupt();
      } else {
        send();
      }
    }
  }
</script>

<div class="border-t p-4">
  <div class="mx-auto flex max-w-3xl gap-2">
    <textarea
      bind:value={input}
      onkeydown={handleKeydown}
      class="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      rows="1"
      placeholder={$activeSessionId ? "Type a message..." : "Create or select a session first"}
      disabled={!$activeSessionId}
    ></textarea>
    {#if $isStreaming}
      <button
        onclick={interrupt}
        class="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground"
      >
        Stop
      </button>
    {:else}
      <button
        onclick={send}
        disabled={!input.trim() || !$activeSessionId}
        class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        Send
      </button>
    {/if}
  </div>
</div>
