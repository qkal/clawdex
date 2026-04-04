<script lang="ts">
  import SessionList from "./SessionList.svelte";
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  function handleNewSession() {
    $wsClient?.send({ type: "create_session" } as Op);
  }
</script>

<aside class="flex w-64 flex-col border-r">
  <div class="flex items-center justify-between p-3">
    <span class="text-sm font-medium">Sessions</span>
    <button
      onclick={handleNewSession}
      class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
    >
      + New
    </button>
  </div>
  <div class="flex-1 overflow-y-auto">
    <SessionList />
  </div>
</aside>
