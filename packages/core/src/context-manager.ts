import type { ChatMessage } from "@clawdex/shared-types";

/**
 * Rough token estimate: ~4 characters per token.
 * Good enough for compaction threshold checks without a tokenizer dependency.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Check whether the session should be auto-compacted. */
export function shouldAutoCompact(opts: {
  totalTokens: number;
  contextWindow: number;
  compactThreshold: number;
}): boolean {
  const limit = opts.contextWindow * opts.compactThreshold;
  return opts.totalTokens > limit;
}

/** Build the prompt sent to the LLM to request a conversation summary. */
export function buildCompactPrompt(messages: readonly ChatMessage[]): string {
  const history = messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n\n");

  return [
    "Please provide a concise summary of the following conversation.",
    "Focus on: what was accomplished, what files were changed, key decisions made,",
    "and any pending work. Keep it under 500 words.",
    "",
    "---",
    history || "(empty conversation)",
    "---",
    "",
    "Provide the summary below:",
  ].join("\n");
}

/**
 * Build a compacted message list: replace all messages with a single
 * system message containing the summary, preserving the last user message.
 */
export function compactMessages(
  summary: string,
  lastUserMessage?: ChatMessage,
): ChatMessage[] {
  const result: ChatMessage[] = [
    {
      id: "compact-summary",
      role: "system",
      content: `[Previous conversation summary]\n\n${summary}`,
      timestamp: new Date().toISOString(),
    },
  ];
  if (lastUserMessage) {
    result.push(lastUserMessage);
  }
  return result;
}
