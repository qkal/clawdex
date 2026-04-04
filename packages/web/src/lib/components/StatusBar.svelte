<script lang="ts">
  import { connectionStatus } from "../stores/connection.js";
  import { activeSnapshot } from "../stores/session.js";
</script>

<footer class="flex h-8 items-center justify-between border-t px-4 text-xs text-muted-foreground">
  <span>
    {#if $activeSnapshot}
      Sandbox: {$activeSnapshot.sandboxPolicy}
    {:else}
      Ready
    {/if}
  </span>
  <span>{$connectionStatus}</span>
</footer>
