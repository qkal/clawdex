<script lang="ts">
  interface Props {
    command: string;
    output: string;
    exitCode?: number;
    stream?: "stdout" | "stderr";
  }
  let { command, output, exitCode, stream = "stdout" }: Props = $props();
</script>

<div class="rounded-md bg-zinc-900 p-3 font-mono text-sm">
  <div class="mb-1 flex items-center gap-2 text-xs text-zinc-400">
    <span>$</span>
    <span class="font-medium text-zinc-200">{command}</span>
    {#if exitCode !== undefined}
      <span class:text-green-400={exitCode === 0} class:text-red-400={exitCode !== 0}>
        exit {exitCode}
      </span>
    {/if}
  </div>
  <pre
    class="max-h-60 overflow-auto whitespace-pre-wrap"
    class:text-zinc-200={stream === "stdout"}
    class:text-red-400={stream === "stderr"}
  >{output}</pre>
</div>
