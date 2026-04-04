import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

export class FileReadTool implements ITool {
  readonly name = "file_read";
  readonly description = "Read the contents of a file at the given path.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to read (relative to working directory or absolute)" },
    },
    required: ["path"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const rawPath = call.args.path as string;
    const fullPath = isAbsolute(rawPath) ? rawPath : resolve(ctx.workingDir, rawPath);

    const check = ctx.sandbox.checkFileRead(fullPath);
    if (!check.allowed) {
      return {
        output: `Permission denied: file read not allowed for ${rawPath}. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const content = await readFile(fullPath, "utf-8");
      return {
        output: content,
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: `File not found or unreadable: ${rawPath}. ${message}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
