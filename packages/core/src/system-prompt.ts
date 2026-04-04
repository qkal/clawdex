import type { ClawdexConfig } from "@clawdex/shared-types";

export interface SystemPromptOptions {
  config: ClawdexConfig;
  model: string;
  workingDir: string;
  sandboxPolicy: string;
  /** Additional context from memories, skills, etc. */
  additionalContext?: string;
}

export function buildSystemPrompt(opts: SystemPromptOptions): string {
  const { config, model, workingDir, sandboxPolicy, additionalContext } = opts;
  const today = new Date().toISOString().slice(0, 10);

  const sections: string[] = [];

  sections.push(
    `You are a coding assistant powered by ${model}.`,
    "",
    "## Environment",
    `- Working directory: ${workingDir}`,
    `- Platform: ${process.platform}`,
    `- Date: ${today}`,
    `- Sandbox policy: ${sandboxPolicy}`,
  );

  if (config.developer_instructions) {
    sections.push(
      "",
      "## Developer Instructions",
      config.developer_instructions,
    );
  }

  sections.push(
    "",
    "## Tools",
    "You have access to tools for reading files, writing files, running shell commands, and applying patches.",
    "Use tools to accomplish the user's requests. Always verify your work.",
  );

  if (sandboxPolicy === "read-only") {
    sections.push(
      "",
      "## Sandbox Restrictions",
      "You are in read-only mode. You may read files and run safe commands but cannot write files or execute destructive operations.",
    );
  }

  if (additionalContext) {
    sections.push("", additionalContext);
  }

  return sections.join("\n");
}
