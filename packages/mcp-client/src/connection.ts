import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig, McpConnectionState, McpToolDefinition } from "./types.js";

export class McpConnection {
  readonly serverName: string;
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  state: McpConnectionState = "disconnected";
  error?: string;

  constructor(private readonly config: McpServerConfig) {
    this.serverName = config.name;
  }

  async connect(): Promise<void> {
    this.state = "connecting";
    try {
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });

      this.client = new Client(
        { name: "clawdex", version: "0.0.1" },
        { capabilities: {} },
      );

      await this.client.connect(this.transport);
      this.state = "connected";
    } catch (err) {
      this.state = "failed";
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      // Best effort
    }
    this.client = null;
    this.transport = null;
    this.state = "disconnected";
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.client || this.state !== "connected") return [];

    const result = await this.client.listTools();
    return (result.tools ?? []).map((t) => ({
      server: this.serverName,
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text?: string }> }> {
    if (!this.client || this.state !== "connected") {
      throw new Error(`MCP server ${this.serverName} is not connected`);
    }
    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content ?? []) as Array<{ type: string; text?: string }>,
    };
  }
}
