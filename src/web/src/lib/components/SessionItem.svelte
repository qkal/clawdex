<script lang="ts">
  import type { SessionSummary } from "@clawdex/shared-types";

  interface Props {
    session: SessionSummary;
    active: boolean;
    onSelect: (id: string) => void;
  }
  let { session, active, onSelect }: Props = $props();
</script>

<button
  onclick={() => onSelect(session.id)}
  class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
  class:bg-accent={active}
>
  <div class="truncate font-medium">
    {session.name || `Session ${session.id.slice(0, 6)}`}
  </div>
  <div class="text-xs text-muted-foreground">
    {session.messageCount} messages
  </div>
</button>
