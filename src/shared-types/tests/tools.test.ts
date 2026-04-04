import { describe, expect, test } from "bun:test";
import type { ITool, ToolCall, ToolResult, ToolContext } from "../src/tools";

describe("ITool interface", () => {
  test("can be implemented with correct shape", () => {
    const tool: ITool = {
      name: "file_read",
      description: "Read a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
      execute: async (_call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
        return { output: "file contents", success: true };
      },
    };
    expect(tool.name).toBe("file_read");
  });

  test("ToolResult can include durationMs", () => {
    const result: ToolResult = {
      output: "done",
      success: true,
      durationMs: 42,
    };
    expect(result.durationMs).toBe(42);
  });

  test("ToolResult can indicate failure", () => {
    const result: ToolResult = {
      output: "error: file not found",
      success: false,
    };
    expect(result.success).toBe(false);
  });
});
