import { describe, expect, test } from "bun:test";
import { parseConfig } from "../src/schema";
import { DEFAULT_CONFIG } from "../src/defaults";

describe("configSchema", () => {
  test("accepts empty object and fills defaults", () => {
    const result = parseConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("gpt-4o");
      expect(result.data.sandbox_mode).toBe("workspace-write");
      expect(result.data.approval_policy).toBe("on-request");
      expect(result.data.server.port).toBe(3141);
      expect(result.data.server.host).toBe("127.0.0.1");
      expect(result.data.auth.api_key_env).toBe("OPENAI_API_KEY");
      expect(result.data.history.max_sessions).toBe(100);
    }
  });

  test("accepts valid partial config", () => {
    const result = parseConfig({
      model: "gpt-4o-mini",
      sandbox_mode: "read-only",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("gpt-4o-mini");
      expect(result.data.sandbox_mode).toBe("read-only");
      expect(result.data.server.port).toBe(3141);
    }
  });

  test("rejects invalid sandbox_mode", () => {
    const result = parseConfig({ sandbox_mode: "yolo" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid port", () => {
    const result = parseConfig({ server: { port: 99999 } });
    expect(result.success).toBe(false);
  });

  test("accepts MCP server config", () => {
    const result = parseConfig({
      mcp_servers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mcp_servers.filesystem.command).toBe("npx");
    }
  });

  test("DEFAULT_CONFIG passes validation", () => {
    const result = parseConfig(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });
});
