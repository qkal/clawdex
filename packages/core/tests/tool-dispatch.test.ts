import { describe, test, expect } from "bun:test";
import { dispatchToolCall } from "../src/tool-dispatch.js";
import type { ITool, ToolCall, ToolResult, ToolContext } from "@clawdex/shared-types";
import { ToolRegistry } from "@clawdex/tools";
import { MockSandbox } from "@clawdex/testkit";

function createMockTool(name: string, handler: (args: Record<string, unknown>) => string): ITool {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: { type: "object", properties: {} },
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      return {
        output: handler(call.args),
        success: true,
      };
    },
  };
}

describe("dispatchToolCall", () => {
  test("dispatches to the correct tool by name", async () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("file-read", () => "file contents"));
    registry.register(createMockTool("shell", () => "shell output"));

    const call: ToolCall = {
      callId: "call-1",
      tool: "file-read",
      args: { path: "/tmp/test.txt" },
    };
    const ctx: ToolContext = {
      workingDir: "/tmp",
      sandbox: new MockSandbox(),
    };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("file contents");
    expect(result.callId).toBe("call-1");
  });

  test("returns error result for unknown tool", async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = {
      callId: "call-2",
      tool: "unknown-tool",
      args: {},
    };
    const ctx: ToolContext = {
      workingDir: "/tmp",
      sandbox: new MockSandbox(),
    };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("unknown-tool");
  });

  test("catches tool execution errors and returns failure result", async () => {
    const registry = new ToolRegistry();
    const failingTool: ITool = {
      name: "failing",
      description: "always fails",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        throw new Error("boom");
      },
    };
    registry.register(failingTool);

    const call: ToolCall = { callId: "call-3", tool: "failing", args: {} };
    const ctx: ToolContext = { workingDir: "/tmp", sandbox: new MockSandbox() };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("boom");
  });
});