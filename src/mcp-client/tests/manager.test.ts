import { describe, test, expect } from "bun:test";
import { McpManager } from "../src/manager.js";
import type { McpServerConfig } from "../src/types.js";

describe("McpManager", () => {
  test("initializes with empty server list", () => {
    const manager = new McpManager();
    expect(manager.getServerStatuses()).toEqual([]);
  });

  test("addServer registers a server config", () => {
    const manager = new McpManager();
    const config: McpServerConfig = {
      name: "test-server",
      command: "echo",
      args: ["hello"],
      enabled: true,
    };
    manager.addServer(config);
    const statuses = manager.getServerStatuses();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].name).toBe("test-server");
    expect(statuses[0].status).toBe("disconnected");
  });

  test("removeServer removes a server", () => {
    const manager = new McpManager();
    manager.addServer({ name: "s1", command: "echo" });
    manager.removeServer("s1");
    expect(manager.getServerStatuses()).toHaveLength(0);
  });

  test("getTools returns empty array when no servers connected", () => {
    const manager = new McpManager();
    expect(manager.getTools()).toEqual([]);
  });
});
