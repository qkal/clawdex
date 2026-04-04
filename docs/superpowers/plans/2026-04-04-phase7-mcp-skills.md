# Phase 7: MCP + Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `mcp-client` package (connect to configured MCP servers, discover their tools, expose them as `ITool` instances) and the `skills` package (filesystem-based skill/plugin discovery, manifest parsing, plugin loading, registry).

**Architecture:** `mcp-client` uses `@modelcontextprotocol/sdk` to connect to MCP servers defined in config. Each discovered MCP tool is wrapped as an `ITool` so core can dispatch to it uniformly. `skills` reads skill manifests from `~/.clawdex/skills/` (global) and `<project>/.clawdex/skills/` (local), parses their TOML/JSON manifests, registers them, and exposes them for invocation. Skills can provide custom system prompt instructions, and plugins can bundle MCP servers.

**Tech Stack:** TypeScript, Bun (runtime + test), `@modelcontextprotocol/sdk`, `@clawdex/shared-types`, `@clawdex/testkit`, `smol-toml`

**Depends on:** Phases 1-5 (MVP-Alpha complete), Phase 6 (auth for MCP server auth)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` — sections 3, 4

---

## File Structure

### packages/mcp-client/

```
packages/mcp-client/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports
│   ├── connection.ts              ← McpConnection: connect to a single MCP server
│   ├── manager.ts                 ← McpManager: manage multiple connections, lifecycle
│   ├── tool-adapter.ts            ← Wrap MCP tools as ITool instances
│   └── types.ts                   ← McpServerConfig, connection state types
└── tests/
    ├── tool-adapter.test.ts       ← MCP → ITool wrapping tests
    ├── manager.test.ts            ← Connection lifecycle, multi-server
    └── connection.test.ts         ← Single connection tests (mocked transport)
```

### packages/skills/

```
packages/skills/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports
│   ├── discovery.ts               ← Scan filesystem for skill manifests
│   ├── manifest.ts                ← Parse skill manifest (TOML/JSON)
│   ├── registry.ts                ← SkillRegistry: lookup, list, invoke
│   ├── plugin-loader.ts           ← Load plugin bundles (skills + MCP servers)
│   └── types.ts                   ← SkillManifest, PluginManifest internal types
└── tests/
    ├── discovery.test.ts          ← Filesystem scanning tests
    ├── manifest.test.ts           ← Manifest parsing tests
    ├── registry.test.ts           ← Skill lookup and invocation
    └── plugin-loader.test.ts      ← Plugin loading tests
```

---

## Task 1: MCP Client — Tool Adapter

**Files:**
- Create: `packages/mcp-client/package.json`
- Create: `packages/mcp-client/tsconfig.json`
- Create: `packages/mcp-client/src/types.ts`
- Create: `packages/mcp-client/src/tool-adapter.ts`
- Create: `packages/mcp-client/tests/tool-adapter.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/mcp-client/package.json`:
```json
{
  "name": "@clawdex/mcp-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clawdex/shared-types": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.1"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

`packages/mcp-client/src/types.ts`:
```typescript
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
```

- [ ] **Step 2: Write the failing test**

`packages/mcp-client/tests/tool-adapter.test.ts`:
```typescript
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
```

- [ ] **Step 3: Write the tool adapter**

`packages/mcp-client/src/tool-adapter.ts`:
```typescript
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";
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
    parameters: (def.inputSchema ?? { type: "object", properties: {} }) as ToolSchema["parameters"],

    async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
      try {
        const result = await callTool(def.name, call.args);
        const text = result.content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)
          .join("\n");

        return {
          callId: call.callId,
          output: text || "(no output)",
          success: true,
        };
      } catch (err) {
        return {
          callId: call.callId,
          output: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
          success: false,
        };
      }
    },
  };
}
```

- [ ] **Step 4: Run test**

Run: `cd packages/mcp-client && bun test tests/tool-adapter.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-client/ tsconfig.build.json
git commit -m "feat(mcp-client): scaffold package with MCP tool adapter"
```

---

## Task 2: MCP Client — Connection Manager

**Files:**
- Create: `packages/mcp-client/src/connection.ts`
- Create: `packages/mcp-client/src/manager.ts`
- Create: `packages/mcp-client/src/index.ts`
- Create: `packages/mcp-client/tests/manager.test.ts`

- [ ] **Step 1: Write the MCP connection wrapper**

`packages/mcp-client/src/connection.ts`:
```typescript
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
```

- [ ] **Step 2: Write the manager test**

`packages/mcp-client/tests/manager.test.ts`:
```typescript
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
```

- [ ] **Step 3: Write the manager**

`packages/mcp-client/src/manager.ts`:
```typescript
import type { ITool } from "@clawdex/shared-types";
import type { McpServerConfig, McpToolDefinition } from "./types.js";
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
        results.push({
          name,
          status: "connected",
          toolCount: tools.length,
        });
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

  /** Get all ITool instances from connected MCP servers. */
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
```

- [ ] **Step 4: Write index.ts**

`packages/mcp-client/src/index.ts`:
```typescript
export { McpManager } from "./manager.js";
export type { McpServerStatus } from "./manager.js";
export { McpConnection } from "./connection.js";
export { createMcpToolAdapter } from "./tool-adapter.js";
export type { McpServerConfig, McpConnectionState, McpToolDefinition } from "./types.js";
```

- [ ] **Step 5: Run tests**

Run: `cd packages/mcp-client && bun test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-client/
git commit -m "feat(mcp-client): add McpManager with connection lifecycle and tool discovery"
```

---

## Task 3: Skills Package — Discovery + Manifest Parsing

**Files:**
- Create: `packages/skills/package.json`
- Create: `packages/skills/tsconfig.json`
- Create: `packages/skills/src/types.ts`
- Create: `packages/skills/src/manifest.ts`
- Create: `packages/skills/src/discovery.ts`
- Create: `packages/skills/tests/manifest.test.ts`
- Create: `packages/skills/tests/discovery.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/skills/package.json`:
```json
{
  "name": "@clawdex/skills",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clawdex/shared-types": "workspace:*",
    "smol-toml": "^1.3.1"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

`packages/skills/src/types.ts`:
```typescript
export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  /** System prompt instructions to inject when this skill is active. */
  instructions?: string;
  /** The command to run (for tool-type skills). */
  command?: string;
  /** Scope: global or project-local. Set during discovery, not in file. */
  scope?: "global" | "project";
  /** Filesystem path to the skill directory. */
  path?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  skills?: SkillManifest[];
  /** MCP servers bundled with the plugin. */
  mcpServers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}
```

- [ ] **Step 2: Write manifest parsing test**

`packages/skills/tests/manifest.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { parseSkillManifest, parsePluginManifest } from "../src/manifest.js";

describe("parseSkillManifest", () => {
  test("parses a valid TOML skill manifest", () => {
    const toml = `
id = "my-skill"
name = "My Skill"
description = "Does cool things"
version = "1.0.0"
instructions = "Always be helpful"
`;
    const result = parseSkillManifest(toml, "toml");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("my-skill");
    expect(result!.name).toBe("My Skill");
    expect(result!.instructions).toBe("Always be helpful");
  });

  test("parses a valid JSON skill manifest", () => {
    const json = JSON.stringify({
      id: "json-skill",
      name: "JSON Skill",
      description: "From JSON",
    });
    const result = parseSkillManifest(json, "json");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("json-skill");
  });

  test("returns null for invalid content", () => {
    expect(parseSkillManifest("not valid", "toml")).toBeNull();
    expect(parseSkillManifest("not json", "json")).toBeNull();
  });

  test("returns null for missing required fields", () => {
    const toml = `name = "Missing ID"`;
    expect(parseSkillManifest(toml, "toml")).toBeNull();
  });
});

describe("parsePluginManifest", () => {
  test("parses a plugin with skills and MCP servers", () => {
    const json = JSON.stringify({
      id: "my-plugin",
      name: "My Plugin",
      description: "A plugin",
      skills: [
        { id: "s1", name: "Skill 1", description: "First skill" },
      ],
      mcpServers: [
        { name: "server1", command: "node", args: ["server.js"] },
      ],
    });
    const result = parsePluginManifest(json);
    expect(result).not.toBeNull();
    expect(result!.skills).toHaveLength(1);
    expect(result!.mcpServers).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Write manifest parser**

`packages/skills/src/manifest.ts`:
```typescript
import { parse as parseTOML } from "smol-toml";
import type { SkillManifest, PluginManifest } from "./types.js";

/** Parse a skill manifest from TOML or JSON. */
export function parseSkillManifest(
  content: string,
  format: "toml" | "json",
): SkillManifest | null {
  try {
    const data = format === "toml" ? parseTOML(content) : JSON.parse(content);

    if (!data.id || !data.name || !data.description) return null;

    return {
      id: String(data.id),
      name: String(data.name),
      description: String(data.description),
      version: data.version ? String(data.version) : undefined,
      instructions: data.instructions ? String(data.instructions) : undefined,
      command: data.command ? String(data.command) : undefined,
    };
  } catch {
    return null;
  }
}

/** Parse a plugin manifest from JSON. */
export function parsePluginManifest(content: string): PluginManifest | null {
  try {
    const data = JSON.parse(content);
    if (!data.id || !data.name || !data.description) return null;

    return {
      id: String(data.id),
      name: String(data.name),
      description: String(data.description),
      version: data.version ? String(data.version) : undefined,
      skills: data.skills,
      mcpServers: data.mcpServers,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write discovery test**

`packages/skills/tests/discovery.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverSkills } from "../src/discovery.js";

describe("discoverSkills", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-skills-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("discovers skills from skill.toml files", async () => {
    const skillDir = join(dir, "my-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "skill.toml"),
      `id = "my-skill"\nname = "My Skill"\ndescription = "Test skill"\n`,
    );

    const skills = await discoverSkills([dir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("my-skill");
    expect(skills[0].path).toBe(skillDir);
  });

  test("discovers skills from skill.json files", async () => {
    const skillDir = join(dir, "json-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "skill.json"),
      JSON.stringify({ id: "json-skill", name: "JSON", description: "From JSON" }),
    );

    const skills = await discoverSkills([dir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("json-skill");
  });

  test("returns empty array for empty directory", async () => {
    const skills = await discoverSkills([dir]);
    expect(skills).toEqual([]);
  });

  test("skips invalid manifests", async () => {
    const skillDir = join(dir, "broken");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "skill.toml"), "invalid toml {{{}");

    const skills = await discoverSkills([dir]);
    expect(skills).toEqual([]);
  });

  test("merges skills from multiple directories", async () => {
    const dir2 = await mkdtemp(join(tmpdir(), "clawdex-skills2-"));
    const s1 = join(dir, "s1");
    const s2 = join(dir2, "s2");
    await mkdir(s1, { recursive: true });
    await mkdir(s2, { recursive: true });
    await writeFile(join(s1, "skill.toml"), `id="s1"\nname="S1"\ndescription="One"\n`);
    await writeFile(join(s2, "skill.toml"), `id="s2"\nname="S2"\ndescription="Two"\n`);

    const skills = await discoverSkills([dir, dir2]);
    expect(skills).toHaveLength(2);

    await rm(dir2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 5: Write discovery module**

`packages/skills/src/discovery.ts`:
```typescript
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SkillManifest } from "./types.js";
import { parseSkillManifest } from "./manifest.js";

/**
 * Scan directories for skill manifests (skill.toml or skill.json).
 * Each skill lives in its own subdirectory within a skills directory.
 */
export async function discoverSkills(searchDirs: string[]): Promise<SkillManifest[]> {
  const skills: SkillManifest[] = [];

  for (const searchDir of searchDirs) {
    try {
      const entries = await readdir(searchDir);

      for (const entry of entries) {
        const skillDir = join(searchDir, entry);
        const s = await stat(skillDir).catch(() => null);
        if (!s?.isDirectory()) continue;

        // Try skill.toml first, then skill.json
        const manifest = await tryLoadManifest(skillDir);
        if (manifest) {
          manifest.path = skillDir;
          skills.push(manifest);
        }
      }
    } catch {
      // Directory doesn't exist or is inaccessible
    }
  }

  return skills;
}

async function tryLoadManifest(skillDir: string): Promise<SkillManifest | null> {
  // Try TOML
  try {
    const content = await readFile(join(skillDir, "skill.toml"), "utf-8");
    const manifest = parseSkillManifest(content, "toml");
    if (manifest) return manifest;
  } catch {
    // No skill.toml
  }

  // Try JSON
  try {
    const content = await readFile(join(skillDir, "skill.json"), "utf-8");
    const manifest = parseSkillManifest(content, "json");
    if (manifest) return manifest;
  } catch {
    // No skill.json
  }

  return null;
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/skills && bun test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/skills/ tsconfig.build.json
git commit -m "feat(skills): add manifest parsing and filesystem discovery"
```

---

## Task 4: Skills Package — Registry

**Files:**
- Create: `packages/skills/src/registry.ts`
- Create: `packages/skills/src/plugin-loader.ts`
- Create: `packages/skills/src/index.ts`
- Create: `packages/skills/tests/registry.test.ts`

- [ ] **Step 1: Write registry test**

`packages/skills/tests/registry.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { SkillRegistry } from "../src/registry.js";
import type { SkillManifest } from "../src/types.js";

describe("SkillRegistry", () => {
  test("register and get by id", () => {
    const registry = new SkillRegistry();
    const skill: SkillManifest = {
      id: "test-skill",
      name: "Test",
      description: "A test skill",
    };
    registry.register(skill);
    expect(registry.get("test-skill")).toEqual(skill);
  });

  test("get returns undefined for unknown id", () => {
    const registry = new SkillRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });

  test("list returns all registered skills", () => {
    const registry = new SkillRegistry();
    registry.register({ id: "a", name: "A", description: "First" });
    registry.register({ id: "b", name: "B", description: "Second" });
    const list = registry.list();
    expect(list).toHaveLength(2);
  });

  test("listInfo returns SkillInfo format", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "my-skill",
      name: "My Skill",
      description: "Cool",
      scope: "global",
    });
    const infos = registry.listInfo();
    expect(infos).toHaveLength(1);
    expect(infos[0]).toEqual({
      id: "my-skill",
      name: "My Skill",
      description: "Cool",
      scope: "global",
    });
  });

  test("getInstructions aggregates active skill instructions", () => {
    const registry = new SkillRegistry();
    registry.register({ id: "a", name: "A", description: "A", instructions: "Use TypeScript" });
    registry.register({ id: "b", name: "B", description: "B", instructions: "Be concise" });
    registry.register({ id: "c", name: "C", description: "C" }); // no instructions

    const instructions = registry.getInstructions();
    expect(instructions).toContain("TypeScript");
    expect(instructions).toContain("concise");
  });
});
```

- [ ] **Step 2: Write the registry**

`packages/skills/src/registry.ts`:
```typescript
import type { SkillInfo } from "@clawdex/shared-types";
import type { SkillManifest } from "./types.js";

export class SkillRegistry {
  private skills = new Map<string, SkillManifest>();

  register(skill: SkillManifest): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillManifest | undefined {
    return this.skills.get(id);
  }

  list(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  listInfo(): SkillInfo[] {
    return this.list().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      scope: s.scope ?? "global",
    }));
  }

  /** Aggregate instructions from all registered skills that have them. */
  getInstructions(): string {
    const parts: string[] = [];
    for (const skill of this.skills.values()) {
      if (skill.instructions) {
        parts.push(`[${skill.name}] ${skill.instructions}`);
      }
    }
    return parts.join("\n\n");
  }
}
```

- [ ] **Step 3: Write plugin loader**

`packages/skills/src/plugin-loader.ts`:
```typescript
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parsePluginManifest } from "./manifest.js";
import type { PluginManifest } from "./types.js";

/**
 * Scan directories for plugin bundles (plugin.json).
 * Each plugin lives in its own subdirectory.
 */
export async function discoverPlugins(searchDirs: string[]): Promise<PluginManifest[]> {
  const plugins: PluginManifest[] = [];

  for (const searchDir of searchDirs) {
    try {
      const entries = await readdir(searchDir);

      for (const entry of entries) {
        const pluginDir = join(searchDir, entry);
        const s = await stat(pluginDir).catch(() => null);
        if (!s?.isDirectory()) continue;

        try {
          const content = await readFile(join(pluginDir, "plugin.json"), "utf-8");
          const manifest = parsePluginManifest(content);
          if (manifest) {
            plugins.push(manifest);
          }
        } catch {
          // No plugin.json
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return plugins;
}
```

- [ ] **Step 4: Write index.ts**

`packages/skills/src/index.ts`:
```typescript
export { SkillRegistry } from "./registry.js";
export { discoverSkills } from "./discovery.js";
export { discoverPlugins } from "./plugin-loader.js";
export { parseSkillManifest, parsePluginManifest } from "./manifest.js";
export type { SkillManifest, PluginManifest } from "./types.js";
```

- [ ] **Step 5: Run tests**

Run: `cd packages/skills && bun test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/skills/
git commit -m "feat(skills): add SkillRegistry and plugin loader"
```

---

## Task 5: Integration — Wire MCP + Skills into Core

- [ ] **Step 1: Update core's EngineOptions**

Add optional `mcpManager` and `skillRegistry` to `EngineOptions` in `packages/core/src/types.ts`.

- [ ] **Step 2: Update ClawdexEngine to register MCP tools**

In `packages/core/src/engine.ts`, during engine initialization, connect MCP servers from config and register their tools into the tool registry. Inject skill instructions into the system prompt.

- [ ] **Step 3: Update the server to handle MCP/skills ops**

In `packages/server/src/http.ts`, add handlers for `list_mcp_tools`, `refresh_mcp_servers`, `list_skills`.

- [ ] **Step 4: Run full test suite**

Run: `pnpm -r run test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/ packages/server/
git commit -m "feat: wire MCP client and skills into core engine"
```
