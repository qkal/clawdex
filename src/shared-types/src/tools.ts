import type { ISandbox } from "./sandbox";

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolSchema {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  output: string;
  success: boolean;
  durationMs?: number;
  exitCode?: number;
}

export interface ToolContext {
  workingDir: string;
  sandbox: ISandbox;
}

export interface ITool {
  name: string;
  description: string;
  parameters: ToolSchema;
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}
