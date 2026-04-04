<script lang="ts">
  import { sessionList, activeSessionId } from "../stores/session.js";
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  function selectSession(id: string) {
    $activeSessionId = id;
    $wsClient?.send({ type: "load_session", sessionId: id } as Op);
  }
</script>

<ul class="space-y-1 px-2">
  {#each $sessionList as session (session.id)}
    <li>
      <button
        onclick={() => selectSession(session.id)}
        class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
        class:bg-accent={$activeSessionId === session.id}
      >
        <div class="truncate font-medium">
          {session.name || `Session ${session.id.slice(0, 6)}`}
        </div>
        <div class="text-xs text-muted-foreground">
          {session.messageCount} messages
        </div>
      </button>
    </li>
  {/each}
</ul>
