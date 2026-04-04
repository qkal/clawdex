import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

export class FileWriteTool implements ITool {
  readonly name = "file_write";
  readonly description = "Write content to a file at the given path. Creates parent directories if needed.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write (relative or absolute)" },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const rawPath = call.args.path as string;
    const content = call.args.content as string;
    const fullPath = isAbsolute(rawPath) ? rawPath : resolve(ctx.workingDir, rawPath);

    const check = ctx.sandbox.checkFileWrite(fullPath);
    if (!check.allowed) {
      return {
        output: `Permission denied: file write not allowed for ${rawPath}. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
      return {
        output: `Successfully wrote ${content.length} bytes to ${rawPath}`,
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
