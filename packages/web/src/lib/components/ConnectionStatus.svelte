<script lang="ts">
  import { connectionStatus } from "../stores/connection.js";
</script>

<div class="flex items-center gap-1.5">
  <div
    class="h-2 w-2 rounded-full"
    class:bg-green-500={$connectionStatus === "connected"}
    class:bg-yellow-500={$connectionStatus === "connecting"}
    class:bg-red-500={$connectionStatus === "disconnected"}
  ></div>
  <span class="text-xs text-muted-foreground">{$connectionStatus}</span>
</div>
