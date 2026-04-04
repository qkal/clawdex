<script lang="ts">
  import type { UIMessage } from "../stores/messages.js";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";
  import ToolCallCard from "./ToolCallCard.svelte";
  import ReasoningBlock from "./ReasoningBlock.svelte";

  interface Props {
    message: UIMessage;
  }
  let { message }: Props = $props();
</script>

{#if message.role === "user"}
  <UserMessage content={message.content} />
{:else if message.role === "assistant"}
  {#if message.reasoning}
    <ReasoningBlock content={message.reasoning} />
  {/if}
  <AgentMessage content={message.content} streaming={message.streaming} />
{:else if message.role === "system" && message.toolCalls}
  {#each message.toolCalls as tc (tc.callId)}
    <ToolCallCard toolCall={tc} />
  {/each}
{/if}
