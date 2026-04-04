<script lang="ts">
  import { selectedModel } from "../stores/ui.js";
  import { connectionStatus } from "../stores/connection.js";

  const models = ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"];
</script>

<header class="flex h-12 items-center justify-between border-b px-4">
  <h1 class="text-lg font-semibold">Clawdex</h1>
  <div class="flex items-center gap-3">
    <select
      bind:value={$selectedModel}
      class="rounded-md border bg-background px-2 py-1 text-sm"
    >
      {#each models as model}
        <option value={model}>{model}</option>
      {/each}
    </select>
    <div class="flex items-center gap-1.5">
      <div
        class="h-2 w-2 rounded-full"
        class:bg-green-500={$connectionStatus === "connected"}
        class:bg-yellow-500={$connectionStatus === "connecting"}
        class:bg-red-500={$connectionStatus === "disconnected"}
      ></div>
      <span class="text-xs text-muted-foreground">{$connectionStatus}</span>
    </div>
  </div>
</header>
