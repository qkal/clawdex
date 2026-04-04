<script lang="ts">
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  interface Props {
    type: "exec" | "patch";
    callId: string;
    command?: string;
    path?: string;
    risk?: string;
  }
  let { type, callId, command, path, risk = "medium" }: Props = $props();

  let decided = $state(false);

  function approve() {
    decided = true;
    const op = type === "exec"
      ? { type: "exec_approval", callId, decision: "approve" } as Op
      : { type: "patch_approval", callId, decision: "approve" } as Op;
    $wsClient?.send(op);
  }

  function deny() {
    decided = true;
    const op = type === "exec"
      ? { type: "exec_approval", callId, decision: "deny" } as Op
      : { type: "patch_approval", callId, decision: "deny" } as Op;
    $wsClient?.send(op);
  }
</script>

<div class="rounded-md border-2 p-4"
  class:border-yellow-500={risk === "medium"}
  class:border-red-500={risk === "high"}
  class:border-green-500={risk === "low"}
>
  <div class="mb-2 flex items-center gap-2">
    <span class="rounded px-2 py-0.5 text-xs font-medium"
      class:bg-yellow-100={risk === "medium"}
      class:bg-red-100={risk === "high"}
      class:bg-green-100={risk === "low"}
      class:text-yellow-800={risk === "medium"}
      class:text-red-800={risk === "high"}
      class:text-green-800={risk === "low"}
    >
      {risk} risk
    </span>
    <span class="text-sm font-medium">
      {type === "exec" ? "Command Approval" : "Patch Approval"}
    </span>
  </div>

  {#if command}
    <pre class="mb-3 rounded bg-muted p-2 text-xs font-mono">{command}</pre>
  {/if}
  {#if path}
    <p class="mb-3 text-sm">File: <code class="rounded bg-muted px-1">{path}</code></p>
  {/if}

  {#if !decided}
    <div class="flex gap-2">
      <button
        onclick={approve}
        class="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
      >
        Approve
      </button>
      <button
        onclick={deny}
        class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
      >
        Deny
      </button>
    </div>
  {:else}
    <p class="text-xs text-muted-foreground">Decision submitted.</p>
  {/if}
</div>
