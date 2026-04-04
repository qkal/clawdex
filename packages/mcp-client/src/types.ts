export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export type McpConnectionState = "disconnected" | "connecting" | "connected" | "failed";

export interface McpToolDefinition {
  server: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}
