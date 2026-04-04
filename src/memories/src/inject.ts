/**
 * Build a memory context block to inject into the system prompt.
 * Returns empty string if no memories are available.
 */
export function buildMemoryContext(summary: string | null): string {
  if (!summary) return "";
  return ["## Memory (from previous sessions)", "", summary].join("\n");
}
