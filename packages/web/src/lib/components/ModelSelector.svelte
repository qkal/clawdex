<script lang="ts">
  import { selectedModel } from "../stores/ui.js";

  const models = ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"];
</script>

<select
  bind:value={$selectedModel}
  class="rounded-md border bg-background px-2 py-1 text-sm"
>
  {#each models as model}
    <option value={model}>{model}</option>
  {/each}
</select>
