# Phase 2: Tools & Sandbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `tools` package (file-read, file-write, shell, apply-patch) and the `sandbox` package (NoopSandbox + interface). These are the agent's hands — how it interacts with the filesystem and processes.

**Architecture:** Each tool implements the `ITool` interface from `@clawdex/shared-types`. Tools receive a `ToolContext` containing the working directory and an `ISandbox` instance for permission checks. The sandbox package provides a `NoopSandbox` for development and defines the factory for platform-specific backends later.

**Tech Stack:** TypeScript, Bun (runtime + test), `@clawdex/shared-types` (interfaces), `@clawdex/testkit` (mocks)

**Depends on:** Phase 1 (shared-types, config, testkit must be complete)

---

## File Structure

### packages/tools/

```
packages/tools/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: all tools + registry
│   ├── registry.ts                ← ToolRegistry: lookup tools by name
│   ├── file-read.ts               ← FileReadTool: read file contents
│   ├── file-write.ts              ← FileWriteTool: write file (sandbox-checked)
│   ├── shell.ts                   ← ShellTool: spawn child process
│   └── apply-patch.ts             ← ApplyPatchTool: parse and apply Codex patch format
└── tests/
    ├── file-read.test.ts
    ├── file-write.test.ts
    ├── shell.test.ts
    ├── apply-patch.test.ts
    └── registry.test.ts
```

### packages/sandbox/

```
packages/sandbox/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: createSandbox, NoopSandbox
│   ├── noop.ts                    ← NoopSandbox: allows everything (dev mode)
│   └── factory.ts                 ← createSandbox factory based on platform + policy
└── tests/
    ├── noop.test.ts
    └── factory.test.ts
```

---

## Task 1: Sandbox Package — NoopSandbox

**Files:**
- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/sandbox/src/noop.ts`
- Create: `packages/sandbox/src/factory.ts`
- Create: `packages/sandbox/src/index.ts`
- Create: `packages/sandbox/tests/noop.test.ts`
- Create: `packages/sandbox/tests/factory.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/sandbox/package.json`:
```json
{
  "name": "@clawdex/sandbox",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "dependencies": {
    "@clawdex/shared-types": "workspace:*"
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

`packages/sandbox/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [
    { "path": "../shared-types" }
  ]
}
```

Add to `tsconfig.build.json` references:
```json
{ "path": "packages/sandbox" }
```

Run: `pnpm install`

- [ ] **Step 2: Write failing test for NoopSandbox**

`packages/sandbox/tests/noop.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { NoopSandbox } from "../src/noop";

describe("NoopSandbox", () => {
  test("allows all file reads", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkFileRead("/etc/passwd").allowed).toBe(true);
    expect(sandbox.checkFileRead("C:\\Windows\\System32").allowed).toBe(true);
  });

  test("allows all file writes", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkFileWrite("/home/user/file.txt").allowed).toBe(true);
  });

  test("allows all exec", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkExec("rm -rf /").allowed).toBe(true);
  });

  test("allows all network", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkNetwork("evil.com").allowed).toBe(true);
  });

  test("has danger-full-access policy", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.policy.type).toBe("danger-full-access");
    expect(sandbox.policy.networkAccess).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/sandbox && bun test tests/noop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement NoopSandbox**

`packages/sandbox/src/noop.ts`:
```ts
import type { ISandbox, SandboxPolicy, SandboxCheckResult } from "@clawdex/shared-types";

export class NoopSandbox implements ISandbox {
  readonly policy: SandboxPolicy = {
    type: "danger-full-access",
    writableRoots: [],
    networkAccess: true,
  };

  checkFileRead(_path: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkFileWrite(_path: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkExec(_command: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkNetwork(_host: string): SandboxCheckResult {
    return { allowed: true };
  }
}
```

- [ ] **Step 5: Write test and implement factory**

`packages/sandbox/tests/factory.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { createSandbox } from "../src/factory";
import { NoopSandbox } from "../src/noop";

describe("createSandbox", () => {
  test("returns NoopSandbox for danger-full-access", () => {
    const sandbox = createSandbox("danger-full-access", { writableRoots: [], networkAccess: true });
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });

  test("returns NoopSandbox for any mode (MVP — platform backends not implemented)", () => {
    const sandbox = createSandbox("workspace-write", { writableRoots: ["/project"], networkAccess: false });
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });
});
```

`packages/sandbox/src/factory.ts`:
```ts
import type { ISandbox, SandboxPolicyType } from "@clawdex/shared-types";
import { NoopSandbox } from "./noop";

export interface SandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

export function createSandbox(_policyType: SandboxPolicyType, _options: SandboxOptions): ISandbox {
  // MVP: all policies use NoopSandbox. Platform backends (Windows, Linux)
  // will be implemented in Phase 8.
  return new NoopSandbox();
}
```

`packages/sandbox/src/index.ts`:
```ts
export { NoopSandbox } from "./noop";
export { createSandbox } from "./factory";
export type { SandboxOptions } from "./factory";
```

- [ ] **Step 6: Run tests**

Run: `cd packages/sandbox && bun test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/ tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(sandbox): add NoopSandbox and createSandbox factory"
```

---

## Task 2: Tools Package — FileReadTool

**Files:**
- Create: `packages/tools/package.json`
- Create: `packages/tools/tsconfig.json`
- Create: `packages/tools/src/file-read.ts`
- Create: `packages/tools/src/index.ts`
- Create: `packages/tools/tests/file-read.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/tools/package.json`:
```json
{
  "name": "@clawdex/tools",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "dependencies": {
    "@clawdex/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*"
  },
  "scripts": {
    "test": "bun test --pattern '*.test.ts' --exclude '*.integration.*'",
    "test:integration": "bun test --pattern '*.integration.test.ts'",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

`packages/tools/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [
    { "path": "../shared-types" }
  ]
}
```

Add to `tsconfig.build.json` references:
```json
{ "path": "packages/tools" }
```

Run: `pnpm install`

- [ ] **Step 2: Write failing test for FileReadTool**

`packages/tools/tests/file-read.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileReadTool } from "../src/file-read";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("FileReadTool", () => {
  let tempDir: string;
  let tool: FileReadTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new FileReadTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("has correct name and description", () => {
    expect(tool.name).toBe("file_read");
    expect(tool.description).toContain("Read");
  });

  test("reads file contents", async () => {
    await writeFile(join(tempDir, "test.txt"), "hello world");
    const call: ToolCall = {
      callId: "c1",
      tool: "file_read",
      args: { path: "test.txt" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello world");
  });

  test("resolves relative paths against workingDir", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "index.ts"), "export {}");
    const call: ToolCall = {
      callId: "c2",
      tool: "file_read",
      args: { path: "src/index.ts" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("export {}");
  });

  test("returns error for missing file", async () => {
    const call: ToolCall = {
      callId: "c3",
      tool: "file_read",
      args: { path: "nonexistent.txt" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  test("checks sandbox before reading", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileRead: ["/etc/shadow"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const call: ToolCall = {
      callId: "c4",
      tool: "file_read",
      args: { path: "/etc/shadow" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/tools && bun test tests/file-read.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement FileReadTool**

`packages/tools/src/file-read.ts`:
```ts
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

export class FileReadTool implements ITool {
  readonly name = "file_read";
  readonly description = "Read the contents of a file at the given path.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to read (relative to working directory or absolute)" },
    },
    required: ["path"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const rawPath = call.args.path as string;
    const fullPath = isAbsolute(rawPath) ? rawPath : resolve(ctx.workingDir, rawPath);

    const check = ctx.sandbox.checkFileRead(fullPath);
    if (!check.allowed) {
      return {
        output: `Permission denied: file read not allowed for ${rawPath}. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const content = await readFile(fullPath, "utf-8");
      return {
        output: content,
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: `File not found or unreadable: ${rawPath}. ${message}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
```

`packages/tools/src/index.ts`:
```ts
export { FileReadTool } from "./file-read";
```

- [ ] **Step 5: Run tests**

Run: `cd packages/tools && bun test tests/file-read.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tools/ tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(tools): add FileReadTool with sandbox permission checks"
```

---

## Task 3: Tools — FileWriteTool

**Files:**
- Create: `packages/tools/src/file-write.ts`
- Create: `packages/tools/tests/file-write.test.ts`
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/tools/tests/file-write.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileWriteTool } from "../src/file-write";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("FileWriteTool", () => {
  let tempDir: string;
  let tool: FileWriteTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new FileWriteTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("writes file contents", async () => {
    const call: ToolCall = {
      callId: "c1",
      tool: "file_write",
      args: { path: "output.txt", content: "hello world" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const written = await readFile(join(tempDir, "output.txt"), "utf-8");
    expect(written).toBe("hello world");
  });

  test("creates parent directories", async () => {
    const call: ToolCall = {
      callId: "c2",
      tool: "file_write",
      args: { path: "deep/nested/file.ts", content: "export {}" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const written = await readFile(join(tempDir, "deep", "nested", "file.ts"), "utf-8");
    expect(written).toBe("export {}");
  });

  test("checks sandbox before writing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileWrite: ["/etc"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const call: ToolCall = {
      callId: "c3",
      tool: "file_write",
      args: { path: "/etc/passwd", content: "hacked" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

`packages/tools/src/file-write.ts`:
```ts
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

export class FileWriteTool implements ITool {
  readonly name = "file_write";
  readonly description = "Write content to a file at the given path. Creates parent directories if needed.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write (relative or absolute)" },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const rawPath = call.args.path as string;
    const content = call.args.content as string;
    const fullPath = isAbsolute(rawPath) ? rawPath : resolve(ctx.workingDir, rawPath);

    const check = ctx.sandbox.checkFileWrite(fullPath);
    if (!check.allowed) {
      return {
        output: `Permission denied: file write not allowed for ${rawPath}. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
      return {
        output: `Successfully wrote ${content.length} bytes to ${rawPath}`,
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
```

- [ ] **Step 3: Run tests, update index, commit**

Add to `packages/tools/src/index.ts`:
```ts
export { FileWriteTool } from "./file-write";
```

Run: `cd packages/tools && bun test`
Expected: all tests PASS.

```bash
git add packages/tools/
git commit -m "feat(tools): add FileWriteTool with parent directory creation"
```

---

## Task 4: Tools — ShellTool

**Files:**
- Create: `packages/tools/src/shell.ts`
- Create: `packages/tools/tests/shell.test.ts`
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/tools/tests/shell.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ShellTool } from "../src/shell";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("ShellTool", () => {
  let tempDir: string;
  let tool: ShellTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new ShellTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("has correct name", () => {
    expect(tool.name).toBe("shell");
  });

  test("executes a simple command", async () => {
    const call: ToolCall = {
      callId: "c1",
      tool: "shell",
      args: { command: "echo hello" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  test("captures stderr", async () => {
    const call: ToolCall = {
      callId: "c2",
      tool: "shell",
      args: { command: "echo error >&2" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.output).toContain("error");
  });

  test("returns non-zero exit code on failure", async () => {
    const call: ToolCall = {
      callId: "c3",
      tool: "shell",
      args: { command: "exit 42" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(42);
  });

  test("runs in the correct working directory", async () => {
    const call: ToolCall = {
      callId: "c4",
      tool: "shell",
      args: { command: "pwd" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    // Normalize paths for cross-platform comparison
    expect(result.output.trim().replace(/\\/g, "/").toLowerCase())
      .toContain(tempDir.replace(/\\/g, "/").toLowerCase());
  });

  test("checks sandbox before executing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { exec: ["rm -rf"] },
    });
    const ctx2: ToolContext = { workingDir: tempDir, sandbox };
    const call: ToolCall = {
      callId: "c5",
      tool: "shell",
      args: { command: "rm -rf /" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });

  test("respects timeout", async () => {
    const call: ToolCall = {
      callId: "c6",
      tool: "shell",
      args: { command: "sleep 60", timeout_ms: 500 },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("timed out");
  }, 5000);
});
```

- [ ] **Step 2: Run test, verify failure, implement**

`packages/tools/src/shell.ts`:
```ts
import { resolve } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ShellTool implements ITool {
  readonly name = "shell";
  readonly description = "Execute a shell command in the working directory. Returns stdout, stderr, and exit code.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      timeout_ms: { type: "string", description: "Timeout in milliseconds (default: 30000)" },
    },
    required: ["command"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const command = call.args.command as string;
    const timeoutMs = (call.args.timeout_ms as number) ?? DEFAULT_TIMEOUT_MS;
    const cwd = resolve(ctx.workingDir);

    const check = ctx.sandbox.checkExec(command);
    if (!check.allowed) {
      return {
        output: `Permission denied: execution not allowed. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

      const proc = Bun.spawn(shellArgs, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env },
      });

      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), timeoutMs),
      );

      const exitPromise = proc.exited.then((code) => ({ code }));
      const raceResult = await Promise.race([exitPromise, timeoutPromise]);

      if (raceResult === "timeout") {
        proc.kill();
        return {
          output: `Command timed out after ${timeoutMs}ms: ${command}`,
          success: false,
          exitCode: -1,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = raceResult.code;
      const output = [stdout, stderr].filter(Boolean).join("\n");

      return {
        output,
        success: exitCode === 0,
        exitCode,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to execute command: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
```

- [ ] **Step 3: Update index, run tests, commit**

Add to `packages/tools/src/index.ts`:
```ts
export { ShellTool } from "./shell";
```

Run: `cd packages/tools && bun test`
Expected: all tests PASS.

```bash
git add packages/tools/
git commit -m "feat(tools): add ShellTool with timeout and sandbox checks"
```

---

## Task 5: Tools — ApplyPatchTool

**Files:**
- Create: `packages/tools/src/apply-patch.ts`
- Create: `packages/tools/tests/apply-patch.test.ts`
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/tools/tests/apply-patch.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyPatchTool } from "../src/apply-patch";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("ApplyPatchTool", () => {
  let tempDir: string;
  let tool: ApplyPatchTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new ApplyPatchTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("has correct name", () => {
    expect(tool.name).toBe("apply_patch");
  });

  test("creates a new file", async () => {
    const patch = `--- /dev/null
+++ new-file.txt
@@ -0,0 +1,2 @@
+line one
+line two
`;
    const call: ToolCall = {
      callId: "c1",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const content = await readFile(join(tempDir, "new-file.txt"), "utf-8");
    expect(content).toBe("line one\nline two\n");
  });

  test("modifies an existing file", async () => {
    await writeFile(join(tempDir, "existing.txt"), "old line\n");
    const patch = `--- existing.txt
+++ existing.txt
@@ -1 +1 @@
-old line
+new line
`;
    const call: ToolCall = {
      callId: "c2",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const content = await readFile(join(tempDir, "existing.txt"), "utf-8");
    expect(content).toBe("new line\n");
  });

  test("deletes a file", async () => {
    await writeFile(join(tempDir, "to-delete.txt"), "content\n");
    const patch = `--- to-delete.txt
+++ /dev/null
@@ -1 +0,0 @@
-content
`;
    const call: ToolCall = {
      callId: "c3",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const exists = await Bun.file(join(tempDir, "to-delete.txt")).exists();
    expect(exists).toBe(false);
  });

  test("checks sandbox before writing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileWrite: ["/etc"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const patch = `--- /dev/null
+++ /etc/evil.txt
@@ -0,0 +1 @@
+hacked
`;
    const call: ToolCall = {
      callId: "c4",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

`packages/tools/src/apply-patch.ts`:
```ts
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

interface PatchFile {
  oldPath: string | null;
  newPath: string | null;
  hunks: PatchHunk[];
}

function parsePatch(patch: string): PatchFile[] {
  const files: PatchFile[] = [];
  const lines = patch.split("\n");
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("--- ")) {
      const oldPath = lines[i].slice(4).trim();
      i++;
      if (i >= lines.length || !lines[i].startsWith("+++ ")) {
        break;
      }
      const newPath = lines[i].slice(4).trim();
      i++;

      const file: PatchFile = {
        oldPath: oldPath === "/dev/null" ? null : oldPath,
        newPath: newPath === "/dev/null" ? null : newPath,
        hunks: [],
      };

      while (i < lines.length && lines[i].startsWith("@@")) {
        const match = lines[i].match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) break;
        const hunk: PatchHunk = {
          oldStart: parseInt(match[1], 10),
          oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
          lines: [],
        };
        i++;
        while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("--- ")) {
          if (lines[i].startsWith("+") || lines[i].startsWith("-") || lines[i].startsWith(" ")) {
            hunk.lines.push(lines[i]);
          } else if (lines[i] === "") {
            // Empty line at end of patch
          }
          i++;
        }
        file.hunks.push(hunk);
      }

      files.push(file);
    } else {
      i++;
    }
  }

  return files;
}

function applyHunks(original: string, hunks: PatchHunk[]): string {
  const originalLines = original.split("\n");
  // Remove trailing empty line from split if the file ended with newline
  if (originalLines[originalLines.length - 1] === "") {
    originalLines.pop();
  }

  let offset = 0;

  for (const hunk of hunks) {
    const startIndex = hunk.oldStart - 1 + offset;
    const newLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else if (line.startsWith("-")) {
        // skip removed line
      } else if (line.startsWith(" ")) {
        newLines.push(line.slice(1));
      }
    }

    originalLines.splice(startIndex, hunk.oldCount, ...newLines);
    offset += hunk.newCount - hunk.oldCount;
  }

  return originalLines.join("\n") + "\n";
}

export class ApplyPatchTool implements ITool {
  readonly name = "apply_patch";
  readonly description = "Apply a unified diff patch to files in the working directory.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      patch: { type: "string", description: "Unified diff patch content" },
    },
    required: ["patch"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const patchContent = call.args.patch as string;

    try {
      const files = parsePatch(patchContent);
      if (files.length === 0) {
        return {
          output: "No files found in patch",
          success: false,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      const results: string[] = [];

      for (const file of files) {
        const isCreate = file.oldPath === null && file.newPath !== null;
        const isDelete = file.oldPath !== null && file.newPath === null;
        const isModify = file.oldPath !== null && file.newPath !== null;
        const targetPath = file.newPath ?? file.oldPath!;
        const fullPath = isAbsolute(targetPath) ? targetPath : resolve(ctx.workingDir, targetPath);

        // Check sandbox permissions for write operations
        if (isCreate || isModify) {
          const check = ctx.sandbox.checkFileWrite(fullPath);
          if (!check.allowed) {
            return {
              output: `Permission denied: write not allowed for ${targetPath}. ${check.reason ?? ""}`.trim(),
              success: false,
              durationMs: Math.round(performance.now() - startTime),
            };
          }
        }

        if (isCreate) {
          const newContent = file.hunks
            .flatMap((h) => h.lines.filter((l) => l.startsWith("+")).map((l) => l.slice(1)))
            .join("\n") + "\n";
          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, newContent, "utf-8");
          results.push(`Created ${targetPath}`);
        } else if (isDelete) {
          await unlink(fullPath);
          results.push(`Deleted ${file.oldPath}`);
        } else if (isModify) {
          const original = await readFile(fullPath, "utf-8");
          const modified = applyHunks(original, file.hunks);
          await writeFile(fullPath, modified, "utf-8");
          results.push(`Modified ${targetPath}`);
        }
      }

      return {
        output: results.join("\n"),
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to apply patch: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
```

- [ ] **Step 3: Update index, run tests, commit**

Add to `packages/tools/src/index.ts`:
```ts
export { ApplyPatchTool } from "./apply-patch";
```

Run: `cd packages/tools && bun test`
Expected: all tests PASS.

```bash
git add packages/tools/
git commit -m "feat(tools): add ApplyPatchTool with unified diff parsing"
```

---

## Task 6: Tools — ToolRegistry

**Files:**
- Create: `packages/tools/src/registry.ts`
- Create: `packages/tools/tests/registry.test.ts`
- Modify: `packages/tools/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/tools/tests/registry.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "../src/registry";
import { FileReadTool } from "../src/file-read";
import { FileWriteTool } from "../src/file-write";
import { ShellTool } from "../src/shell";
import { ApplyPatchTool } from "../src/apply-patch";

describe("ToolRegistry", () => {
  test("registers and retrieves built-in tools", () => {
    const registry = ToolRegistry.withBuiltins();
    expect(registry.get("file_read")).toBeInstanceOf(FileReadTool);
    expect(registry.get("file_write")).toBeInstanceOf(FileWriteTool);
    expect(registry.get("shell")).toBeInstanceOf(ShellTool);
    expect(registry.get("apply_patch")).toBeInstanceOf(ApplyPatchTool);
  });

  test("returns undefined for unknown tool", () => {
    const registry = ToolRegistry.withBuiltins();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  test("lists all tool names", () => {
    const registry = ToolRegistry.withBuiltins();
    const names = registry.listNames();
    expect(names).toContain("file_read");
    expect(names).toContain("file_write");
    expect(names).toContain("shell");
    expect(names).toContain("apply_patch");
    expect(names).toHaveLength(4);
  });

  test("lists all tool schemas", () => {
    const registry = ToolRegistry.withBuiltins();
    const schemas = registry.listSchemas();
    expect(schemas).toHaveLength(4);
    expect(schemas[0]).toHaveProperty("name");
    expect(schemas[0]).toHaveProperty("description");
    expect(schemas[0]).toHaveProperty("parameters");
  });

  test("allows registering custom tools", () => {
    const registry = ToolRegistry.withBuiltins();
    const customTool = new FileReadTool();
    registry.register({ ...customTool, name: "custom_read" } as any);
    expect(registry.get("custom_read")).toBeDefined();
    expect(registry.listNames()).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Implement ToolRegistry**

`packages/tools/src/registry.ts`:
```ts
import type { ITool } from "@clawdex/shared-types";
import { FileReadTool } from "./file-read";
import { FileWriteTool } from "./file-write";
import { ShellTool } from "./shell";
import { ApplyPatchTool } from "./apply-patch";

export interface ToolSchemaEntry {
  name: string;
  description: string;
  parameters: ITool["parameters"];
}

export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  listSchemas(): ToolSchemaEntry[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  static withBuiltins(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(new FileReadTool());
    registry.register(new FileWriteTool());
    registry.register(new ShellTool());
    registry.register(new ApplyPatchTool());
    return registry;
  }
}
```

- [ ] **Step 3: Update index, run tests, commit**

Update `packages/tools/src/index.ts`:
```ts
export { FileReadTool } from "./file-read";
export { FileWriteTool } from "./file-write";
export { ShellTool } from "./shell";
export { ApplyPatchTool } from "./apply-patch";
export { ToolRegistry } from "./registry";
export type { ToolSchemaEntry } from "./registry";
```

Run: `cd packages/tools && bun test`
Expected: all tests PASS.

```bash
git add packages/tools/
git commit -m "feat(tools): add ToolRegistry with built-in tool registration"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run full workspace typecheck and tests**

```bash
pnpm typecheck && pnpm test
```
Expected: all 6 packages (shared-types, config, auth, testkit, sandbox, tools) pass.

- [ ] **Step 2: Verify cross-package imports**

```bash
cd packages/tools && bun -e "
import { ToolRegistry } from '@clawdex/tools';
import { createSandbox } from '@clawdex/sandbox';
const registry = ToolRegistry.withBuiltins();
const sandbox = createSandbox('workspace-write', { writableRoots: [], networkAccess: false });
console.log('Tools:', registry.listNames().join(', '));
console.log('Sandbox policy:', sandbox.policy.type);
console.log('Phase 2 OK');
"
```
Expected: prints tool names, sandbox policy, "Phase 2 OK".

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve Phase 2 integration issues"
```

Phase 2 is complete. Tools and sandbox are ready for the core engine (Phase 3).
