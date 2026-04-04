import type { MemoryEntry, ConsolidationResult } from "./types.js";

/** Build the prompt for the LLM to consolidate memory entries. */
export function buildConsolidationPrompt(entries: MemoryEntry[]): string {
  const formattedEntries = entries
    .map((e, i) => `${i + 1}. [${e.createdAt}] ${e.content}`)
    .join("\n");

  return [
    "You are a memory consolidation assistant. Review the following memories",
    "collected across multiple sessions and consolidate them into a concise summary.",
    "Remove duplicates, merge related facts, and organize by topic.",
    "Keep the most important and actionable information.",
    "",
    "Raw memories:",
    formattedEntries || "(no memories)",
    "",
    "Produce a consolidated summary (Markdown format, under 1000 words):",
  ].join("\n");
}

/** Parse the LLM's consolidation response. */
export function parseConsolidationResult(
  response: string,
  entriesProcessed: number,
): ConsolidationResult {
  return {
    summary: response.trim(),
    entriesProcessed,
    timestamp: new Date().toISOString(),
  };
}
