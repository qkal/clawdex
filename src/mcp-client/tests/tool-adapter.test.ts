import { describe, test, expect } from "bun:test";
import { createMcpToolAdapter } from "../src/tool-adapter.js";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";
import { MockSandbox } from "@clawdex/testkit";
import type { McpToolDefinition } from "../src/types.js";

describe("createMcpToolAdapter", () => {
  test("creates an ITool with prefixed name", () => {
    const def: McpToolDefinition = {
      server: "my-server",
      name: "get_weather",
      description: "Get weather data",
      inputSchema: { type: "object", properties: { city: { type: "string" } } },
    };
    const callTool = async (_name: string, _args: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: "Sunny, 72F" }],
    });

    const tool = createMcpToolAdapter(def, callTool);
    expect(tool.name).toBe("mcp__my-server__get_weather");
    expect(tool.description).toContain("Get weather data");
  });

  test("execute routes call to the MCP server", async () => {
    const def: McpToolDefinition = {
      server: "test",
      name: "echo",
      description: "Echo back",
    };
    let capturedArgs: Record<string, unknown> = {};
    const callTool = async (_name: string, args: Record<string, unknown>) => {
      capturedArgs = args;
      return { content: [{ type: "text" as const, text: "echoed" }] };
    };

    const tool = createMcpToolAdapter(def, callTool);
    const call: ToolCall = { callId: "c1", tool: tool.name, args: { message: "hello" } };
    const ctx: ToolContext = { workingDir: "/tmp", sandbox: new MockSandbox() };

    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("echoed");
    expect(capturedArgs).toEqual({ message: "hello" });
  });

  test("execute returns failure on MCP error", async () => {
    const def: McpToolDefinition = { server: "test", name: "fail", description: "Fails" };
    const callTool = async () => { throw new Error("MCP timeout"); };

    const tool = createMcpToolAdapter(def, callTool);
    const call: ToolCall = { callId: "c2", tool: tool.name, args: {} };
    const ctx: ToolContext = { workingDir: "/tmp", sandbox: new MockSandbox() };

    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("MCP timeout");
  });
});
