<script lang="ts">
  import { connectionStatus } from "../stores/connection.js";

  interface Props {
    onSubmitApiKey?: (key: string) => void;
  }
  let { onSubmitApiKey }: Props = $props();

  let apiKey = $state("");

  function handleSubmit() {
    if (apiKey.trim() && onSubmitApiKey) {
      onSubmitApiKey(apiKey.trim());
    }
  }
</script>

{#if $connectionStatus === "disconnected"}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div class="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
      <h2 class="mb-2 text-lg font-semibold">Welcome to Clawdex</h2>
      <p class="mb-4 text-sm text-muted-foreground">
        Enter your OpenAI API key to get started.
      </p>
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <input
          type="password"
          bind:value={apiKey}
          placeholder="sk-..."
          class="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!apiKey.trim()}
          class="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Connect
        </button>
      </form>
    </div>
  </div>
{/if}
