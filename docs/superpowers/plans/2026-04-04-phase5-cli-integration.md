# Phase 5: CLI + Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `cli` package — the user-facing `clawdex` binary that starts the server, opens the browser (interactive mode), runs headless turns (exec mode), and provides subcommands for config, auth, sessions, and MCP management. This completes MVP-Alpha.

**Architecture:** The CLI is a thin shell that wires together `config`, `auth`, `core`, and `server`. Interactive mode: load config → create engine → start server → write lock file → open browser. Exec mode: load config → create engine → run single turn → stream output to stdout → exit. Subcommands delegate to the appropriate package.

**Tech Stack:** TypeScript, Bun (runtime), `@clawdex/config`, `@clawdex/auth`, `@clawdex/core`, `@clawdex/server`, `@clawdex/tools`, `@clawdex/sandbox`

**Depends on:** Phases 1-4 (all foundation, tools, core, server, and web must be complete)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` — section 9

---

## File Structure

### packages/cli/

```
packages/cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← main entrypoint (bin)
│   ├── cli.ts                     ← Argument parser + command router
│   ├── interactive.ts             ← Interactive mode: start server + open browser
│   ├── exec.ts                    ← Exec mode: headless single-turn
│   ├── commands/
│   │   ├── config.ts              ← clawdex config (show, edit, set, path)
│   │   ├── auth.ts                ← clawdex auth (login, logout, status)
│   │   ├── sessions.ts            ← clawdex sessions (list, delete, prune)
│   │   └── mcp.ts                 ← clawdex mcp (list, add)
│   ├── lock-file.ts               ← Server lock file management
│   ├── browser.ts                 ← Open browser cross-platform
│   └── output.ts                  ← Exec mode output formatters (text, json, quiet)
└── tests/
    ├── cli.test.ts                ← Argument parsing tests
    ├── lock-file.test.ts          ← Lock file read/write/stale detection
    ├── exec.test.ts               ← Exec mode output formatting
    └── browser.test.ts            ← Browser open command generation
```

---

## Task 1: Package Scaffolding + Argument Parser

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/cli.ts`
- Create: `packages/cli/tests/cli.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package.json**

`packages/cli/package.json`:
```json
{
  "name": "@clawdex/cli",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "bin": {
    "clawdex": "./src/index.ts"
  },
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
    "@clawdex/config": "workspace:*",
    "@clawdex/auth": "workspace:*",
    "@clawdex/core": "workspace:*",
    "@clawdex/server": "workspace:*",
    "@clawdex/tools": "workspace:*",
    "@clawdex/sandbox": "workspace:*"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared-types" },
    { "path": "../config" },
    { "path": "../auth" },
    { "path": "../core" },
    { "path": "../server" },
    { "path": "../tools" },
    { "path": "../sandbox" }
  ]
}
```

- [ ] **Step 3: Write the argument parser test**

`packages/cli/tests/cli.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  test("no args → interactive mode", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("interactive");
  });

  test("exec 'prompt' → exec mode with prompt", () => {
    const result = parseArgs(["exec", "write hello world"]);
    expect(result.command).toBe("exec");
    expect(result.execPrompt).toBe("write hello world");
  });

  test("exec --json → exec with json output", () => {
    const result = parseArgs(["exec", "--json", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execFormat).toBe("json");
  });

  test("exec --quiet → exec with quiet output", () => {
    const result = parseArgs(["exec", "--quiet", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execFormat).toBe("quiet");
  });

  test("exec --ephemeral → no session persistence", () => {
    const result = parseArgs(["exec", "--ephemeral", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execEphemeral).toBe(true);
  });

  test("config → config subcommand", () => {
    const result = parseArgs(["config"]);
    expect(result.command).toBe("config");
    expect(result.subcommand).toBe("show");
  });

  test("config set key value → config set", () => {
    const result = parseArgs(["config", "set", "model", "o3"]);
    expect(result.command).toBe("config");
    expect(result.subcommand).toBe("set");
    expect(result.configKey).toBe("model");
    expect(result.configValue).toBe("o3");
  });

  test("auth login → auth login", () => {
    const result = parseArgs(["auth", "login"]);
    expect(result.command).toBe("auth");
    expect(result.subcommand).toBe("login");
  });

  test("sessions list → sessions list", () => {
    const result = parseArgs(["sessions", "list"]);
    expect(result.command).toBe("sessions");
    expect(result.subcommand).toBe("list");
  });

  test("--model flag sets model override", () => {
    const result = parseArgs(["--model", "o3"]);
    expect(result.flags.model).toBe("o3");
  });

  test("--port flag sets port", () => {
    const result = parseArgs(["--port", "4000"]);
    expect(result.flags.port).toBe(4000);
  });

  test("--no-open flag disables browser open", () => {
    const result = parseArgs(["--no-open"]);
    expect(result.flags.noOpen).toBe(true);
  });

  test("--version flag", () => {
    const result = parseArgs(["--version"]);
    expect(result.command).toBe("version");
  });

  test("--help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.command).toBe("help");
  });

  test("--sandbox flag", () => {
    const result = parseArgs(["--sandbox", "read-only"]);
    expect(result.flags.sandbox).toBe("read-only");
  });

  test("--cwd flag", () => {
    const result = parseArgs(["--cwd", "/tmp/project"]);
    expect(result.flags.cwd).toBe("/tmp/project");
  });
});
```

- [ ] **Step 4: Write the argument parser**

`packages/cli/src/cli.ts`:
```typescript
export interface ParsedArgs {
  command: "interactive" | "exec" | "config" | "auth" | "sessions" | "mcp" | "version" | "help";
  subcommand?: string;
  execPrompt?: string;
  execFormat?: "text" | "json" | "quiet";
  execEphemeral?: boolean;
  configKey?: string;
  configValue?: string;
  sessionId?: string;
  flags: {
    model?: string;
    sandbox?: string;
    port?: number;
    noOpen?: boolean;
    cwd?: string;
    approvalPolicy?: string;
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: ParsedArgs["flags"] = {};
  const positional: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--version") return { command: "version", flags };
    if (arg === "--help" || arg === "-h") return { command: "help", flags };

    if (arg === "--model" && i + 1 < argv.length) {
      flags.model = argv[++i];
    } else if (arg === "--sandbox" && i + 1 < argv.length) {
      flags.sandbox = argv[++i];
    } else if (arg === "--port" && i + 1 < argv.length) {
      flags.port = parseInt(argv[++i], 10);
    } else if (arg === "--no-open") {
      flags.noOpen = true;
    } else if (arg === "--cwd" && i + 1 < argv.length) {
      flags.cwd = argv[++i];
    } else if (arg === "--approval-policy" && i + 1 < argv.length) {
      flags.approvalPolicy = argv[++i];
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
    i++;
  }

  if (positional.length === 0) {
    return { command: "interactive", flags };
  }

  const cmd = positional[0];

  if (cmd === "exec") {
    let execFormat: "text" | "json" | "quiet" = "text";
    let execEphemeral = false;
    const promptParts: string[] = [];

    for (let j = 1; j < positional.length; j++) {
      promptParts.push(positional[j]);
    }

    // Re-scan argv for exec-specific flags
    for (let j = 0; j < argv.length; j++) {
      if (argv[j] === "--json") execFormat = "json";
      if (argv[j] === "--quiet") execFormat = "quiet";
      if (argv[j] === "--ephemeral") execEphemeral = true;
      if (argv[j] === "-i") {
        // Read from stdin — handled at runtime
      }
    }

    // Collect non-flag args after "exec" as the prompt
    const execArgs = argv.slice(argv.indexOf("exec") + 1)
      .filter((a) => !a.startsWith("--"));
    const prompt = execArgs.join(" ");

    return {
      command: "exec",
      execPrompt: prompt || undefined,
      execFormat,
      execEphemeral,
      flags,
    };
  }

  if (cmd === "config") {
    const sub = positional[1] ?? "show";
    return {
      command: "config",
      subcommand: sub,
      configKey: positional[2],
      configValue: positional[3],
      flags,
    };
  }

  if (cmd === "auth") {
    return { command: "auth", subcommand: positional[1] ?? "status", flags };
  }

  if (cmd === "sessions") {
    return {
      command: "sessions",
      subcommand: positional[1] ?? "list",
      sessionId: positional[2],
      flags,
    };
  }

  if (cmd === "mcp") {
    return { command: "mcp", subcommand: positional[1] ?? "list", flags };
  }

  // Unknown first arg — treat as interactive with prompt?
  return { command: "interactive", flags };
}
```

- [ ] **Step 5: Run test**

Run: `cd packages/cli && bun test tests/cli.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Add to tsconfig.build.json and commit**

```bash
git add packages/cli/ tsconfig.build.json
git commit -m "feat(cli): scaffold package with argument parser"
```

---

## Task 2: Lock File Management

**Files:**
- Create: `packages/cli/src/lock-file.ts`
- Create: `packages/cli/tests/lock-file.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/cli/tests/lock-file.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeLockFile,
  readLockFile,
  removeLockFile,
  isLockFileStale,
  type LockFileData,
} from "../src/lock-file.js";

describe("lock file", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-lock-"));
    lockPath = join(dir, "server.lock");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("write and read round-trips", async () => {
    const data: LockFileData = {
      pid: process.pid,
      host: "127.0.0.1",
      port: 3141,
      token: "test-token",
      cwd: "/tmp/project",
      startedAt: new Date().toISOString(),
    };
    await writeLockFile(lockPath, data);
    const read = await readLockFile(lockPath);
    expect(read).toEqual(data);
  });

  test("readLockFile returns null for missing file", async () => {
    const read = await readLockFile(join(dir, "nonexistent.lock"));
    expect(read).toBeNull();
  });

  test("removeLockFile deletes the file", async () => {
    await writeLockFile(lockPath, {
      pid: 1234,
      host: "127.0.0.1",
      port: 3141,
      token: "t",
      cwd: "/",
      startedAt: new Date().toISOString(),
    });
    await removeLockFile(lockPath);
    const read = await readLockFile(lockPath);
    expect(read).toBeNull();
  });

  test("isLockFileStale returns true for dead PID", () => {
    // PID 999999 is almost certainly not running
    expect(isLockFileStale({ pid: 999999 } as LockFileData)).toBe(true);
  });

  test("isLockFileStale returns false for current process PID", () => {
    expect(isLockFileStale({ pid: process.pid } as LockFileData)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && bun test tests/lock-file.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the lock file module**

`packages/cli/src/lock-file.ts`:
```typescript
import { readFile, writeFile, unlink } from "node:fs/promises";

export interface LockFileData {
  pid: number;
  host: string;
  port: number;
  token: string;
  cwd: string;
  startedAt: string;
}

export async function writeLockFile(
  path: string,
  data: LockFileData,
): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

export async function readLockFile(
  path: string,
): Promise<LockFileData | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
}

export async function removeLockFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already removed
  }
}

/** Check if a lock file's PID is still running. */
export function isLockFileStale(data: LockFileData): boolean {
  try {
    // process.kill(pid, 0) throws if process doesn't exist
    process.kill(data.pid, 0);
    return false; // Process is alive
  } catch {
    return true; // Process is dead
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && bun test tests/lock-file.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lock-file.ts packages/cli/tests/lock-file.test.ts
git commit -m "feat(cli): add server lock file management"
```

---

## Task 3: Browser Open + Output Formatters

**Files:**
- Create: `packages/cli/src/browser.ts`
- Create: `packages/cli/src/output.ts`
- Create: `packages/cli/tests/browser.test.ts`
- Create: `packages/cli/tests/exec.test.ts`

- [ ] **Step 1: Write browser open tests**

`packages/cli/tests/browser.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { buildBrowserCommand } from "../src/browser.js";

describe("buildBrowserCommand", () => {
  test("returns platform-appropriate command", () => {
    const url = "http://127.0.0.1:3141/?token=abc";
    const cmd = buildBrowserCommand(url);
    expect(cmd).toBeDefined();
    expect(cmd.length).toBeGreaterThan(0);
    // On Windows it should use "start" or "cmd"
    // On Linux it should use "xdg-open"
    if (process.platform === "win32") {
      expect(cmd[0]).toBe("cmd");
    } else {
      expect(cmd[0]).toBe("xdg-open");
    }
  });
});
```

- [ ] **Step 2: Write browser module**

`packages/cli/src/browser.ts`:
```typescript
import { spawn } from "node:child_process";

/** Return the command array to open a URL in the default browser. */
export function buildBrowserCommand(url: string): string[] {
  switch (process.platform) {
    case "win32":
      return ["cmd", "/c", "start", "", url];
    case "darwin":
      return ["open", url];
    default:
      return ["xdg-open", url];
  }
}

/** Open a URL in the default browser. Fire and forget. */
export function openBrowser(url: string): void {
  const cmd = buildBrowserCommand(url);
  const child = spawn(cmd[0], cmd.slice(1), {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
```

- [ ] **Step 3: Write output formatter tests**

`packages/cli/tests/exec.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { formatExecOutput } from "../src/output.js";
import type { EventMsg } from "@clawdex/shared-types";

describe("formatExecOutput", () => {
  test("text format returns just the message content", () => {
    const events: EventMsg[] = [
      { type: "agent_message", message: "Hello world" } as any,
    ];
    expect(formatExecOutput(events, "text")).toBe("Hello world");
  });

  test("quiet format returns final message only", () => {
    const events: EventMsg[] = [
      { type: "agent_message_delta", delta: "He" } as any,
      { type: "agent_message_delta", delta: "llo" } as any,
      { type: "agent_message", message: "Hello" } as any,
      { type: "turn_complete", turnId: "t1", usage: {} } as any,
    ];
    expect(formatExecOutput(events, "quiet")).toBe("Hello");
  });

  test("json format returns NDJSON", () => {
    const events: EventMsg[] = [
      { type: "agent_message", message: "Hello" } as any,
      { type: "turn_complete", turnId: "t1", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } } as any,
    ];
    const output = formatExecOutput(events, "json");
    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe("agent_message");
    expect(JSON.parse(lines[1]).type).toBe("turn_complete");
  });
});
```

- [ ] **Step 4: Write output module**

`packages/cli/src/output.ts`:
```typescript
import type { EventMsg } from "@clawdex/shared-types";

export function formatExecOutput(
  events: EventMsg[],
  format: "text" | "json" | "quiet",
): string {
  switch (format) {
    case "text": {
      const messages = events
        .filter((e) => e.type === "agent_message")
        .map((e) => (e as any).message);
      return messages.join("\n");
    }

    case "quiet": {
      // Return only the final agent message
      const lastMsg = [...events]
        .reverse()
        .find((e) => e.type === "agent_message");
      return lastMsg ? (lastMsg as any).message : "";
    }

    case "json": {
      return events.map((e) => JSON.stringify(e)).join("\n");
    }
  }
}

/** Stream an event to stdout in the given format. */
export function streamEventToStdout(event: EventMsg, format: "text" | "json" | "quiet"): void {
  switch (format) {
    case "text":
      if (event.type === "agent_message_delta") {
        process.stdout.write((event as any).delta);
      } else if (event.type === "agent_message") {
        process.stdout.write("\n");
      } else if (event.type === "error") {
        process.stderr.write(`Error: ${(event as any).message}\n`);
      }
      break;

    case "json":
      process.stdout.write(JSON.stringify(event) + "\n");
      break;

    case "quiet":
      // Only output at end
      break;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/cli && bun test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/browser.ts packages/cli/src/output.ts packages/cli/tests/
git commit -m "feat(cli): add browser launcher and exec output formatters"
```

---

## Task 4: Interactive Mode + Exec Mode

**Files:**
- Create: `packages/cli/src/interactive.ts`
- Create: `packages/cli/src/exec.ts`

- [ ] **Step 1: Write interactive mode**

`packages/cli/src/interactive.ts`:
```typescript
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "@clawdex/config";
import { createAuthProvider } from "@clawdex/auth";
import { createSandbox } from "@clawdex/sandbox";
import { ToolRegistry } from "@clawdex/tools";
import { ClawdexEngine } from "@clawdex/core";
import { createServer } from "@clawdex/server";
import {
  writeLockFile,
  readLockFile,
  removeLockFile,
  isLockFileStale,
} from "./lock-file.js";
import { openBrowser } from "./browser.js";
import type { ParsedArgs } from "./cli.js";

export async function runInteractive(args: ParsedArgs): Promise<void> {
  const clawdexHome = join(homedir(), ".clawdex");
  await mkdir(clawdexHome, { recursive: true });
  await mkdir(join(clawdexHome, "sessions"), { recursive: true });

  // Load config with CLI flag overrides
  const config = await loadConfig({
    cwd: args.flags.cwd ?? process.cwd(),
    overrides: {
      model: args.flags.model,
      sandbox_mode: args.flags.sandbox as any,
      server: args.flags.port ? { port: args.flags.port } : undefined,
    },
  });

  // Check for existing server
  const lockPath = join(clawdexHome, "server.lock");
  const existing = await readLockFile(lockPath);
  if (existing && !isLockFileStale(existing)) {
    // Reuse existing server
    const url = `http://${existing.host}:${existing.port}/?token=${existing.token}`;
    console.log(`Server already running at ${url}`);
    if (!args.flags.noOpen) {
      openBrowser(url);
    }
    return;
  }

  // Clean up stale lock
  if (existing) {
    await removeLockFile(lockPath);
  }

  // Generate auth token
  const token = randomBytes(32).toString("base64url");

  // Create engine
  const authProvider = createAuthProvider(config.auth);
  const sandbox = createSandbox(config.sandbox_mode);
  const toolRegistry = ToolRegistry.withBuiltins();
  const engine = new ClawdexEngine({
    config,
    authProvider,
    sandbox,
    toolRegistry,
    sessionsDir: join(clawdexHome, "sessions"),
  });

  // Resolve web static dir (relative to CLI package)
  const webBuildDir = join(import.meta.dir, "..", "..", "web", "build");

  // Start server
  const host = config.server?.host ?? "127.0.0.1";
  const port = config.server?.port ?? 3141;
  const server = createServer({
    engine,
    host,
    port,
    token,
    staticDir: webBuildDir,
  });

  // Write lock file
  await writeLockFile(lockPath, {
    pid: process.pid,
    host,
    port: server.port,
    token,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
  });

  const url = `http://${host}:${server.port}/?token=${token}`;
  console.log(`Clawdex server running at ${url}`);

  if (!args.flags.noOpen && config.server?.open_browser !== false) {
    openBrowser(url);
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    await removeLockFile(lockPath);
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
```

- [ ] **Step 2: Write exec mode**

`packages/cli/src/exec.ts`:
```typescript
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "@clawdex/config";
import { createAuthProvider } from "@clawdex/auth";
import { createSandbox } from "@clawdex/sandbox";
import { ToolRegistry } from "@clawdex/tools";
import { ClawdexEngine } from "@clawdex/core";
import type { EventMsg } from "@clawdex/shared-types";
import { streamEventToStdout, formatExecOutput } from "./output.js";
import type { ParsedArgs } from "./cli.js";

export async function runExec(args: ParsedArgs): Promise<number> {
  if (!args.execPrompt) {
    console.error("Error: exec requires a prompt. Usage: clawdex exec \"prompt\"");
    return 1;
  }

  const config = await loadConfig({
    cwd: args.flags.cwd ?? process.cwd(),
    overrides: {
      model: args.flags.model,
      sandbox_mode: args.flags.sandbox as any,
      approval_policy: args.flags.approvalPolicy as any ?? "never",
    },
  });

  const authProvider = createAuthProvider(config.auth);
  const sandbox = createSandbox(config.sandbox_mode);
  const toolRegistry = ToolRegistry.withBuiltins();
  const engine = new ClawdexEngine({
    config,
    authProvider,
    sandbox,
    toolRegistry,
    sessionsDir: args.execEphemeral
      ? undefined
      : join(homedir(), ".clawdex", "sessions"),
  });

  const format = args.execFormat ?? "text";
  const collectedEvents: EventMsg[] = [];

  // Listen for events
  engine.on("event", (event) => {
    collectedEvents.push(event);
    streamEventToStdout(event, format);
  });

  // Create session and run turn
  const session = await engine.createSession({
    workingDir: args.flags.cwd ?? process.cwd(),
  });

  let exitCode = 0;

  try {
    await engine.runTurn(session.id, {
      prompt: args.execPrompt,
      model: args.flags.model,
    });
  } catch (err) {
    console.error(`Error: ${err}`);
    exitCode = 1;
  }

  // For quiet mode, output the final result at the end
  if (format === "quiet") {
    const output = formatExecOutput(collectedEvents, "quiet");
    if (output) {
      process.stdout.write(output + "\n");
    }
  }

  // Check if any errors occurred
  const hadError = collectedEvents.some(
    (e) => e.type === "turn_aborted" && (e as any).reason === "error",
  );
  if (hadError) exitCode = 1;

  return exitCode;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/interactive.ts packages/cli/src/exec.ts
git commit -m "feat(cli): add interactive and exec mode implementations"
```

---

## Task 5: Subcommands (config, auth, sessions, mcp)

**Files:**
- Create: `packages/cli/src/commands/config.ts`
- Create: `packages/cli/src/commands/auth.ts`
- Create: `packages/cli/src/commands/sessions.ts`
- Create: `packages/cli/src/commands/mcp.ts`

- [ ] **Step 1: Write config subcommand**

`packages/cli/src/commands/config.ts`:
```typescript
import { loadConfig } from "@clawdex/config";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import type { ParsedArgs } from "../cli.js";

export async function runConfigCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "show";

  switch (sub) {
    case "show": {
      const config = await loadConfig({ cwd: args.flags.cwd ?? process.cwd() });
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case "path": {
      const globalPath = join(homedir(), ".clawdex", "config.toml");
      console.log(`Global: ${globalPath}`);
      console.log(`Project: ${join(process.cwd(), ".clawdex", "config.toml")}`);
      break;
    }

    case "edit": {
      const editor = process.env.EDITOR || (process.platform === "win32" ? "notepad" : "vi");
      const configPath = join(homedir(), ".clawdex", "config.toml");
      const child = spawn(editor, [configPath], { stdio: "inherit" });
      await new Promise<void>((resolve) => child.on("close", () => resolve()));
      break;
    }

    case "set": {
      if (!args.configKey || args.configValue === undefined) {
        console.error("Usage: clawdex config set <key> <value>");
        return;
      }
      // For MVP, just tell the user to edit the file
      console.log(`Set ${args.configKey} = ${args.configValue}`);
      console.log("Note: direct config editing coming soon. Use 'clawdex config edit' for now.");
      break;
    }

    default:
      console.error(`Unknown config subcommand: ${sub}`);
  }
}
```

- [ ] **Step 2: Write auth subcommand**

`packages/cli/src/commands/auth.ts`:
```typescript
import { createAuthProvider } from "@clawdex/auth";
import { loadConfig } from "@clawdex/config";
import type { ParsedArgs } from "../cli.js";

export async function runAuthCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "status";
  const config = await loadConfig({ cwd: args.flags.cwd ?? process.cwd() });

  switch (sub) {
    case "status": {
      const provider = createAuthProvider(config.auth);
      const status = await provider.getStatus();
      if (status.authenticated) {
        console.log(`Authenticated via ${status.method}`);
        if (status.user) console.log(`User: ${status.user}`);
      } else {
        console.log("Not authenticated");
        console.log("Set OPENAI_API_KEY or run: clawdex auth login");
      }
      break;
    }

    case "login": {
      console.log("OAuth login not yet implemented. Set OPENAI_API_KEY instead.");
      break;
    }

    case "logout": {
      const provider = createAuthProvider(config.auth);
      await provider.logout();
      console.log("Logged out.");
      break;
    }

    default:
      console.error(`Unknown auth subcommand: ${sub}`);
  }
}
```

- [ ] **Step 3: Write sessions subcommand**

`packages/cli/src/commands/sessions.ts`:
```typescript
import { SessionStore } from "@clawdex/core";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ParsedArgs } from "../cli.js";

export async function runSessionsCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "list";
  const store = new SessionStore(join(homedir(), ".clawdex", "sessions"));

  switch (sub) {
    case "list": {
      const sessions = await store.list();
      if (sessions.length === 0) {
        console.log("No sessions found.");
        return;
      }
      for (const s of sessions) {
        const name = s.name ? ` (${s.name})` : "";
        const date = new Date(s.lastActiveAt).toLocaleDateString();
        console.log(`  ${s.id}${name} — ${s.messageCount} msgs — ${date} — ${s.workingDir}`);
      }
      break;
    }

    case "delete": {
      if (!args.sessionId) {
        console.error("Usage: clawdex sessions delete <id>");
        return;
      }
      await store.delete(args.sessionId);
      console.log(`Deleted session ${args.sessionId}`);
      break;
    }

    case "prune": {
      await store.prune({ maxSessions: 100, maxAgeDays: 90 });
      console.log("Pruned old sessions.");
      break;
    }

    default:
      console.error(`Unknown sessions subcommand: ${sub}`);
  }
}
```

- [ ] **Step 4: Write MCP subcommand (stub for MVP)**

`packages/cli/src/commands/mcp.ts`:
```typescript
import type { ParsedArgs } from "../cli.js";

export async function runMcpCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "list";

  switch (sub) {
    case "list":
      console.log("MCP server management coming in Phase 7.");
      console.log("Configure MCP servers in ~/.clawdex/config.toml under [mcp_servers]");
      break;

    case "add":
      console.log("MCP server management coming in Phase 7.");
      break;

    default:
      console.error(`Unknown mcp subcommand: ${sub}`);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/
git commit -m "feat(cli): add config, auth, sessions, and mcp subcommands"
```

---

## Task 6: Main Entrypoint

**Files:**
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Write the main entrypoint**

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env bun

import { parseArgs } from "./cli.js";
import { runInteractive } from "./interactive.js";
import { runExec } from "./exec.js";
import { runConfigCommand } from "./commands/config.js";
import { runAuthCommand } from "./commands/auth.js";
import { runSessionsCommand } from "./commands/sessions.js";
import { runMcpCommand } from "./commands/mcp.js";

const VERSION = "0.0.1-alpha";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case "version":
      console.log(`clawdex ${VERSION}`);
      break;

    case "help":
      printHelp();
      break;

    case "interactive":
      await runInteractive(args);
      break;

    case "exec": {
      const exitCode = await runExec(args);
      process.exit(exitCode);
      break;
    }

    case "config":
      await runConfigCommand(args);
      break;

    case "auth":
      await runAuthCommand(args);
      break;

    case "sessions":
      await runSessionsCommand(args);
      break;

    case "mcp":
      await runMcpCommand(args);
      break;
  }
}

function printHelp(): void {
  console.log(`
clawdex ${VERSION}

Usage:
  clawdex                              Interactive mode (start server + open browser)
  clawdex exec "prompt"                Headless mode (run and exit)
  clawdex config [show|edit|set|path]  Manage configuration
  clawdex auth [login|logout|status]   Manage authentication
  clawdex sessions [list|delete|prune] Manage sessions
  clawdex mcp [list|add]               Manage MCP servers

Options:
  --model <model>              Override model (e.g., gpt-4o, o3)
  --sandbox <mode>             Sandbox mode (read-only, workspace-write, danger-full-access)
  --port <port>                Server port (default: 3141)
  --no-open                    Don't open browser
  --approval-policy <policy>   Approval policy (on-request, always, never)
  --cwd <path>                 Working directory
  --version                    Show version
  --help                       Show this help

Exec-specific:
  --json                       Output events as NDJSON
  --quiet                      Output only final message
  --ephemeral                  Don't persist session
  -i                           Read prompt from stdin
`.trim());
}

main().catch((err) => {
  console.error(`Fatal: ${err}`);
  process.exit(1);
});
```

- [ ] **Step 2: Make the file executable (Unix)**

Run:
```bash
chmod +x packages/cli/src/index.ts 2>/dev/null || true
```

- [ ] **Step 3: Verify the CLI runs**

Run:
```bash
bun packages/cli/src/index.ts --version
```
Expected: `clawdex 0.0.1-alpha`

Run:
```bash
bun packages/cli/src/index.ts --help
```
Expected: Shows help text.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add main entrypoint with command routing"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run all CLI tests**

Run: `cd packages/cli && bun test`
Expected: All tests PASS.

- [ ] **Step 2: Run full monorepo typecheck**

Run: `pnpm -r run typecheck`
Expected: No errors.

- [ ] **Step 3: Run full monorepo tests**

Run: `pnpm -r run test`
Expected: All packages pass.

- [ ] **Step 4: Test interactive mode starts without errors (Ctrl+C to exit)**

Run:
```bash
bun packages/cli/src/index.ts --no-open --port 0
```
Expected: Prints "Clawdex server running at http://127.0.0.1:XXXXX/?token=..." — Ctrl+C to exit.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve integration issues in CLI package"
```
