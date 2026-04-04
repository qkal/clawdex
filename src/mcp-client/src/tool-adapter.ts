import type { ITool, ToolCall, ToolResult, ToolContext } from "@clawdex/shared-types";
import type { McpToolDefinition } from "./types.js";

type McpCallFn = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text?: string }> }>;

/**
 * Wrap an MCP tool definition as an ITool.
 * The tool name is prefixed: mcp__{server}__{tool}
 */
export function createMcpToolAdapter(
  def: McpToolDefinition,
  callTool: McpCallFn,
): ITool {
  const prefixedName = `mcp__${def.server}__${def.name}`;

  return {
    name: prefixedName,
    description: `[MCP: ${def.server}] ${def.description}`,
    parameters: (def.inputSchema ?? { type: "object", properties: {} }) as any,

    async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
      try {
        const result = await callTool(def.name, call.args);
        const text = result.content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)
          .join("\n");

        return {
          output: text || "(no output)",
          success: true,
        };
      } catch (err) {
        return {
          output: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
          success: false,
        };
      }
    },
  };
}
