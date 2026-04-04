import type { ITool } from "@clawdex/shared-types";
import type { McpServerConfig } from "./types.js";
import { McpConnection } from "./connection.js";
import { createMcpToolAdapter } from "./tool-adapter.js";

export interface McpServerStatus {
  name: string;
  status: "disconnected" | "connecting" | "connected" | "failed";
  toolCount: number;
  error?: string;
}

export class McpManager {
  private connections = new Map<string, McpConnection>();
  private toolCache = new Map<string, ITool[]>();

  addServer(config: McpServerConfig): void {
    const conn = new McpConnection(config);
    this.connections.set(config.name, conn);
  }

  removeServer(name: string): void {
    const conn = this.connections.get(name);
    if (conn) {
      conn.disconnect().catch(() => {});
      this.connections.delete(name);
      this.toolCache.delete(name);
    }
  }

  async connectAll(): Promise<McpServerStatus[]> {
    const results: McpServerStatus[] = [];

    for (const [name, conn] of this.connections) {
      try {
        await conn.connect();
        const tools = await conn.listTools();
        const adapted = tools.map((t) =>
          createMcpToolAdapter(t, (n, a) => conn.callTool(n, a))
        );
        this.toolCache.set(name, adapted);
        results.push({ name, status: "connected", toolCount: tools.length });
      } catch (err) {
        results.push({
          name,
          status: "failed",
          toolCount: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  async disconnectAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.disconnect().catch(() => {});
    }
    this.toolCache.clear();
  }

  getTools(): ITool[] {
    const tools: ITool[] = [];
    for (const serverTools of this.toolCache.values()) {
      tools.push(...serverTools);
    }
    return tools;
  }

  getServerStatuses(): McpServerStatus[] {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      status: conn.state as McpServerStatus["status"],
      toolCount: this.toolCache.get(name)?.length ?? 0,
      error: conn.error,
    }));
  }
}
