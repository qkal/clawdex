import type { ToolCall, ToolResult, ToolContext } from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";

/** Tool result with the originating callId attached. */
export interface ToolDispatchResult extends ToolResult {
  callId: string;
}

/**
 * Dispatch a single tool call to the matching tool in the registry.
 * Returns a ToolDispatchResult — never throws.
 */
export async function dispatchToolCall(
  registry: ToolRegistry,
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolDispatchResult> {
  const tool = registry.get(call.tool);

  if (!tool) {
    return {
      callId: call.callId,
      output: `Tool not found: ${call.tool}`,
      success: false,
    };
  }

  try {
    const result = await tool.execute(call, ctx);
    return {
      ...result,
      callId: call.callId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      callId: call.callId,
      output: `Tool execution error: ${message}`,
      success: false,
    };
  }
}
