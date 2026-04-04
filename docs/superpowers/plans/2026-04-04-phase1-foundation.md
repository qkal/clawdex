# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the pnpm monorepo and build the four foundation packages (`shared-types`, `config`, `auth`, `testkit`) that every other clawdex package depends on.

**Architecture:** A pnpm workspace monorepo where `shared-types` is the zero-dependency leaf defining all cross-package contracts. `config` parses TOML and validates against those types. `auth` provides an API key provider (OAuth stubbed). `testkit` provides mock utilities for downstream packages.

**Tech Stack:** TypeScript 5.x (strict), Bun (runtime + test), pnpm 10 (workspaces), Zod (validation), smol-toml (TOML parsing)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md`

---

## File Structure

### Root

```
clawdex/
├── package.json                   ← root: workspace scripts, shared devDeps
├── pnpm-workspace.yaml            ← workspace definition
├── tsconfig.json                  ← base TS config extended by all packages
├── tsconfig.build.json            ← project references for cross-package typecheck
├── eslint.config.js               ← shared flat config
├── .prettierrc.toml               ← already exists, keep as-is
├── .node-version                  ← "22"
├── bunfig.toml                    ← Bun runtime config
└── .gitignore                     ← update with dist/, node_modules/ patterns
```

### packages/shared-types/

```
packages/shared-types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public re-exports
│   ├── errors.ts                  ← typed error classes (ClawdexError, AuthError, ConfigError, etc.)
│   ├── config.ts                  ← config schema types (what a parsed config looks like)
│   ├── tools.ts                   ← ITool interface, ToolCall, ToolResult types
│   ├── sandbox.ts                 ← ISandbox interface, SandboxPolicy types
│   ├── auth.ts                    ← IAuthProvider interface, AuthStatus type
│   ├── events.ts                  ← WS protocol: Submission (Op) and Event (EventMsg) types
│   ├── session.ts                 ← SessionSummary, SessionSnapshot, ChatMessage types
│   └── skills.ts                  ← SkillInfo, PluginInfo, skill manifest types
└── tests/
    └── types.test.ts              ← compile-time type checks + runtime value tests
```

### packages/config/

```
packages/config/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: loadConfig, resolveConfig
│   ├── schema.ts                  ← Zod schema, validation, parse function
│   ├── defaults.ts                ← built-in default config values
│   ├── loader.ts                  ← file discovery, read, merge layers
│   └── env.ts                     ← environment variable mapping + resolution
└── tests/
    ├── schema.test.ts             ← validation tests
    ├── loader.test.ts             ← merge + discovery tests (uses temp files)
    └── env.test.ts                ← env var mapping tests
```

### packages/auth/

```
packages/auth/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: createAuthProvider
│   ├── api-key.ts                 ← ApiKeyAuthProvider implements IAuthProvider
│   └── oauth.ts                   ← OAuthAuthProvider stub (returns not-implemented)
└── tests/
    ├── api-key.test.ts            ← API key resolution tests
    └── provider.test.ts           ← createAuthProvider factory tests
```

### packages/testkit/

```
packages/testkit/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                   ← public re-exports
    ├── mock-llm.ts                ← MockLLMClient: configurable streaming responses
    ├── mock-sandbox.ts            ← MockSandbox: tracks permission checks
    └── fixtures.ts                ← reusable test data: configs, sessions, messages
```

---

## Task 1: Repository Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json` (base)
- Create: `tsconfig.build.json`
- Create: `eslint.config.js`
- Create: `.node-version`
- Create: `bunfig.toml`
- Modify: `.gitignore`

- [x] **Step 1: Create root package.json**

```json
{
  "name": "clawdex",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -b tsconfig.build.json",
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "test": "pnpm -r run test",
    "test:integration": "pnpm -r run test:integration",
    "build": "pnpm -r run build",
    "clean": "pnpm -r run clean",
    "format": "prettier --check .",
    "format:fix": "prettier --write ."
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "eslint": "^9.0.0",
    "prettier": "^3.6.0",
    "typescript": "^5.9.0",
    "typescript-eslint": "^8.0.0"
  },
  "packageManager": "pnpm@10.29.3"
}
```

- [x] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [x] **Step 3: Create base tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["bun-types"]
  }
}
```

- [x] **Step 4: Create tsconfig.build.json**

This file is empty initially — project references are added as packages are created in later tasks.

```json
{
  "files": [],
  "references": []
}
```

- [x] **Step 5: Create eslint.config.js**

```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/", "**/node_modules/", "codex-rs/", "sdk/"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
```

- [x] **Step 6: Create .node-version and bunfig.toml**

`.node-version`:
```
22
```

`bunfig.toml`:
```toml
[test]
coverage = false
```

- [x] **Step 7: Update .gitignore**

Add these lines to the existing `.gitignore`:

```gitignore
# Packages
packages/*/dist/
packages/*/node_modules/
node_modules/

# Bun
*.lockb

# Build
*.tsbuildinfo
```

- [x] **Step 8: Install dependencies and verify**

Run:
```bash
pnpm install
```
Expected: clean install, `pnpm-lock.yaml` updated, no errors.

- [x] **Step 9: Commit**

Execution note: In this run, Step 9 was satisfied via incremental micro-commits for Steps 1-8 rather than one aggregate scaffolding commit.

```bash
git add package.json pnpm-workspace.yaml tsconfig.json tsconfig.build.json eslint.config.js .node-version bunfig.toml .gitignore pnpm-lock.yaml
git commit -m "feat: initialize pnpm workspace monorepo scaffolding"
```

---

## Task 2: shared-types Package — Errors and Config Types

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/errors.ts`
- Create: `packages/shared-types/src/config.ts`
- Create: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/tests/errors.test.ts`
- Modify: `tsconfig.build.json`

- [x] **Step 1: Create package.json and tsconfig.json for shared-types**

`packages/shared-types/package.json`:
```json
{
  "name": "@clawdex/shared-types",
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
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

`packages/shared-types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"]
}
```

Add reference to `tsconfig.build.json`:
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared-types" }
  ]
}
```

- [ ] **Step 2: Write failing test for error classes**

`packages/shared-types/tests/errors.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  ClawdexError,
  AuthError,
  ConfigError,
  SessionError,
  ToolError,
  SandboxError,
  ProtocolError,
} from "../src/errors";

describe("ClawdexError", () => {
  test("is an instance of Error", () => {
    const err = new ClawdexError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.message).toBe("test");
    expect(err.name).toBe("ClawdexError");
  });

  test("supports error code", () => {
    const err = new ClawdexError("test", "INTERNAL_ERROR");
    expect(err.code).toBe("INTERNAL_ERROR");
  });
});

describe("AuthError", () => {
  test("extends ClawdexError", () => {
    const err = new AuthError("no key");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.name).toBe("AuthError");
    expect(err.code).toBe("AUTH_REQUIRED");
  });
});

describe("ConfigError", () => {
  test("includes path to invalid config", () => {
    const err = new ConfigError("bad value", "/home/.clawdex/config.toml");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.configPath).toBe("/home/.clawdex/config.toml");
  });
});

describe("ToolError", () => {
  test("includes tool name", () => {
    const err = new ToolError("failed", "shell");
    expect(err.toolName).toBe("shell");
  });
});

describe("derived errors", () => {
  test("SessionError", () => {
    const err = new SessionError("not found", "SESSION_NOT_FOUND");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("SandboxError", () => {
    const err = new SandboxError("permission denied");
    expect(err).toBeInstanceOf(ClawdexError);
  });

  test("ProtocolError", () => {
    const err = new ProtocolError("invalid submission", "INVALID_SUBMISSION");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.code).toBe("INVALID_SUBMISSION");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/shared-types && bun test`
Expected: FAIL — module `../src/errors` does not exist.

- [ ] **Step 4: Implement error classes**

`packages/shared-types/src/errors.ts`:
```ts
export type ErrorCode =
  | "TURN_IN_PROGRESS"
  | "SESSION_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "INVALID_MODEL"
  | "INVALID_SUBMISSION"
  | "INTERNAL_ERROR";

export class ClawdexError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ClawdexError";
    this.code = code;
  }
}

export class AuthError extends ClawdexError {
  constructor(message: string, code: string = "AUTH_REQUIRED") {
    super(message, code);
    this.name = "AuthError";
  }
}

export class ConfigError extends ClawdexError {
  readonly configPath?: string;

  constructor(message: string, configPath?: string) {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
  }
}

export class SessionError extends ClawdexError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "SessionError";
  }
}

export class ToolError extends ClawdexError {
  readonly toolName: string;

  constructor(message: string, toolName: string) {
    super(message);
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class SandboxError extends ClawdexError {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

export class ProtocolError extends ClawdexError {
  constructor(message: string, code?: ErrorCode) {
    super(message, code);
    this.name = "ProtocolError";
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared-types && bun test`
Expected: all tests PASS.

- [ ] **Step 6: Write config types**

`packages/shared-types/src/config.ts`:
```ts
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  tools?: Record<string, { approval_mode?: string }>;
}

export interface AuthConfig {
  api_key_env: string;
  base_url: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  open_browser: boolean;
}

export interface SandboxConfig {
  writable_roots: string[];
  network_access: boolean;
}

export interface MemoriesConfig {
  enabled: boolean;
}

export interface SkillsConfig {
  enabled: boolean;
  search_paths: string[];
}

export interface PluginsConfig {
  enabled: boolean;
}

export interface HistoryConfig {
  enabled: boolean;
  max_sessions: number;
  max_session_age_days: number;
}

export interface NotifyConfig {
  command: string;
}

export type ApprovalPolicy = "on-request" | "always" | "never";
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ReasoningEffort = "low" | "medium" | "high";

export interface ClawdexConfig {
  model: string;
  model_reasoning_effort: ReasoningEffort;
  model_context_window: number;
  model_auto_compact_token_limit: number;
  developer_instructions: string;
  approval_policy: ApprovalPolicy;
  sandbox_mode: SandboxMode;
  auth: AuthConfig;
  server: ServerConfig;
  sandbox: SandboxConfig;
  mcp_servers: Record<string, McpServerConfig>;
  memories: MemoriesConfig;
  skills: SkillsConfig;
  plugins: PluginsConfig;
  history: HistoryConfig;
  notify: NotifyConfig;
  project_root_markers: string[];
}
```

- [ ] **Step 7: Create initial index.ts and verify typecheck**

`packages/shared-types/src/index.ts`:
```ts
export * from "./errors";
export * from "./config";
```

Run: `cd packages/shared-types && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/ tsconfig.build.json
git commit -m "feat(shared-types): add error classes and config types"
```

---

## Task 3: shared-types — Tool and Sandbox Interfaces

**Files:**
- Create: `packages/shared-types/src/tools.ts`
- Create: `packages/shared-types/src/sandbox.ts`
- Create: `packages/shared-types/src/auth.ts`
- Create: `packages/shared-types/tests/tools.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write failing test for tool types**

`packages/shared-types/tests/tools.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import type { ITool, ToolCall, ToolResult, ToolContext } from "../src/tools";

describe("ITool interface", () => {
  test("can be implemented with correct shape", () => {
    const tool: ITool = {
      name: "file_read",
      description: "Read a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
      execute: async (_call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
        return { output: "file contents", success: true };
      },
    };
    expect(tool.name).toBe("file_read");
  });

  test("ToolResult can include durationMs", () => {
    const result: ToolResult = {
      output: "done",
      success: true,
      durationMs: 42,
    };
    expect(result.durationMs).toBe(42);
  });

  test("ToolResult can indicate failure", () => {
    const result: ToolResult = {
      output: "error: file not found",
      success: false,
    };
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && bun test tests/tools.test.ts`
Expected: FAIL — module `../src/tools` does not exist.

- [ ] **Step 3: Implement tool types**

`packages/shared-types/src/tools.ts`:
```ts
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
```

- [ ] **Step 4: Implement sandbox interface**

`packages/shared-types/src/sandbox.ts`:
```ts
export type SandboxPolicyType =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export interface SandboxPolicy {
  type: SandboxPolicyType;
  writableRoots: string[];
  networkAccess: boolean;
}

export interface SandboxCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ISandbox {
  readonly policy: SandboxPolicy;
  checkFileRead(path: string): SandboxCheckResult;
  checkFileWrite(path: string): SandboxCheckResult;
  checkExec(command: string): SandboxCheckResult;
  checkNetwork(host: string): SandboxCheckResult;
}
```

- [ ] **Step 5: Implement auth interface**

`packages/shared-types/src/auth.ts`:
```ts
export interface AuthStatus {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  user?: string;
}

export interface AuthToken {
  token: string;
  expiresAt?: Date;
}

export interface IAuthProvider {
  getStatus(): Promise<AuthStatus>;
  getToken(): Promise<AuthToken>;
  refresh(): Promise<AuthToken>;
  logout(): Promise<void>;
}
```

- [ ] **Step 6: Update index.ts exports**

`packages/shared-types/src/index.ts`:
```ts
export * from "./errors";
export * from "./config";
export * from "./tools";
export * from "./sandbox";
export * from "./auth";
```

- [ ] **Step 7: Run tests and typecheck**

Run: `cd packages/shared-types && bun test && bunx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add tool, sandbox, and auth interfaces"
```

---

## Task 4: shared-types — WebSocket Protocol Types

**Files:**
- Create: `packages/shared-types/src/events.ts`
- Create: `packages/shared-types/tests/events.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write failing test for protocol types**

`packages/shared-types/tests/events.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import type {
  Submission,
  Op,
  Event,
  EventMsg,
  TokenUsage,
  FileDiff,
  RiskLevel,
} from "../src/events";

describe("Submission types", () => {
  test("user_turn submission has correct shape", () => {
    const sub: Submission = {
      id: "s1",
      op: {
        type: "user_turn",
        prompt: "hello",
        sessionId: "abc123",
      },
    };
    expect(sub.id).toBe("s1");
    expect(sub.op.type).toBe("user_turn");
  });

  test("interrupt submission", () => {
    const sub: Submission = { id: "s2", op: { type: "interrupt" } };
    expect(sub.op.type).toBe("interrupt");
  });

  test("exec_approval submission", () => {
    const sub: Submission = {
      id: "s3",
      op: { type: "exec_approval", callId: "c1", decision: "approve" },
    };
    expect(sub.op.type).toBe("exec_approval");
  });
});

describe("Event types", () => {
  test("turn_started event", () => {
    const evt: Event = {
      submissionId: "s1",
      msg: { type: "turn_started", turnId: "t1", model: "gpt-4o" },
    };
    expect(evt.msg.type).toBe("turn_started");
  });

  test("agent_message_delta event", () => {
    const evt: Event = {
      msg: { type: "agent_message_delta", delta: "Hello" },
    };
    expect(evt.msg.type).toBe("agent_message_delta");
  });

  test("exec_command lifecycle events", () => {
    const begin: EventMsg = {
      type: "exec_command_begin",
      callId: "c1",
      command: "npm test",
      cwd: "/project",
    };
    const delta: EventMsg = {
      type: "exec_command_output_delta",
      callId: "c1",
      chunk: "PASS",
      stream: "stdout",
    };
    const end: EventMsg = {
      type: "exec_command_end",
      callId: "c1",
      exitCode: 0,
    };
    expect(begin.type).toBe("exec_command_begin");
    expect(delta.type).toBe("exec_command_output_delta");
    expect(end.type).toBe("exec_command_end");
  });

  test("error event with code", () => {
    const evt: Event = {
      msg: {
        type: "error",
        message: "already running",
        code: "TURN_IN_PROGRESS",
        fatal: false,
      },
    };
    expect(evt.msg.type).toBe("error");
  });
});

describe("supporting types", () => {
  test("TokenUsage", () => {
    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };
    expect(usage.totalTokens).toBe(150);
  });

  test("FileDiff", () => {
    const diff: FileDiff = {
      path: "src/index.ts",
      status: "modified",
      before: "const x = 1;",
      after: "const x = 2;",
      isBinary: false,
      truncated: false,
    };
    expect(diff.status).toBe("modified");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && bun test tests/events.test.ts`
Expected: FAIL — module `../src/events` does not exist.

- [ ] **Step 3: Implement protocol types**

`packages/shared-types/src/events.ts`:
```ts
import type { ErrorCode } from "./errors";
import type { AuthStatus } from "./auth";

// ── Submissions (Client → Server) ─────────────────────────────

export interface Submission {
  id: string;
  op: Op;
}

export type Op =
  | { type: "user_turn"; prompt: string; sessionId: string; model?: string; effort?: "low" | "medium" | "high" }
  | { type: "interrupt" }
  | { type: "undo" }
  | { type: "compact" }
  | { type: "shutdown" }
  | { type: "exec_approval"; callId: string; decision: "approve" | "deny"; reason?: string }
  | { type: "patch_approval"; callId: string; decision: "approve" | "deny" }
  | { type: "mcp_elicitation_response"; requestId: string; serverName: string; decision: "approve" | "deny"; content?: unknown }
  | { type: "create_session"; workingDir?: string; name?: string }
  | { type: "load_session"; sessionId: string }
  | { type: "delete_session"; sessionId: string }
  | { type: "set_session_name"; sessionId: string; name: string }
  | { type: "list_sessions" }
  | { type: "run_user_shell_command"; command: string }
  | { type: "list_models" }
  | { type: "list_mcp_tools" }
  | { type: "refresh_mcp_servers" }
  | { type: "list_skills"; workingDirs?: string[] }
  | { type: "update_memories" }
  | { type: "drop_memories" }
  | { type: "reload_config" }
  | { type: "start_oauth" }
  | { type: "logout" };

// ── Events (Server → Client) ──────────────────────────────────

export interface Event {
  submissionId?: string;
  msg: EventMsg;
}

export type EventMsg =
  // Connection
  | { type: "connection_ready"; serverVersion: string; authStatus: AuthStatus; activeSession?: SessionSnapshot; activeTurn?: ActiveTurnState }
  // Turn lifecycle
  | { type: "turn_started"; turnId: string; model: string }
  | { type: "turn_complete"; turnId: string; usage: TokenUsage }
  | { type: "turn_aborted"; turnId: string; reason: "user_interrupted" | "error" | "shutdown" }
  | { type: "token_count"; session: TokenUsage; lastTurn?: TokenUsage }
  // Agent output
  | { type: "agent_message_delta"; delta: string }
  | { type: "agent_message"; message: string }
  | { type: "agent_reasoning_delta"; delta: string }
  | { type: "agent_reasoning"; summary: string }
  // Tool calls (generic)
  | { type: "tool_call_begin"; callId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; callId: string; output: string; success: boolean }
  // Shell execution
  | { type: "exec_command_begin"; callId: string; command: string; cwd: string }
  | { type: "exec_command_output_delta"; callId: string; chunk: string; stream: "stdout" | "stderr" }
  | { type: "exec_command_end"; callId: string; exitCode: number }
  // Patch
  | { type: "patch_apply_begin"; callId: string; path: string; patch: string }
  | { type: "patch_apply_end"; callId: string; path: string; success: boolean; error?: string }
  // Diffs
  | { type: "turn_diff"; diffs: FileDiff[] }
  // Approvals
  | { type: "exec_approval_request"; callId: string; command: string; cwd: string; risk: RiskLevel }
  | { type: "patch_approval_request"; callId: string; path: string; patch: string }
  | { type: "mcp_elicitation_request"; requestId: string; serverName: string; message: string; schema?: unknown }
  // MCP
  | { type: "mcp_startup_update"; server: string; status: "connecting" | "connected" | "failed"; error?: string }
  | { type: "mcp_startup_complete"; servers: McpServerStatus[] }
  | { type: "mcp_tool_call_begin"; callId: string; server: string; tool: string; args: Record<string, unknown> }
  | { type: "mcp_tool_call_end"; callId: string; result: unknown; success: boolean }
  | { type: "mcp_list_tools_response"; tools: McpToolInfo[] }
  // Skills
  | { type: "list_skills_response"; skills: SkillInfo[] }
  // Models
  | { type: "list_models_response"; models: ModelInfo[] }
  // Sessions
  | { type: "session_created"; sessionId: string; name?: string }
  | { type: "session_loaded"; session: SessionSnapshot }
  | { type: "session_list"; sessions: SessionSummary[] }
  | { type: "session_name_updated"; sessionId: string; name: string }
  | { type: "session_deleted"; sessionId: string }
  // Context
  | { type: "context_compacted"; previousTokens: number; newTokens: number }
  | { type: "undo_started" }
  | { type: "undo_completed"; turnId: string; revertedFiles: string[] }
  // Auth
  | { type: "auth_status"; status: AuthStatus }
  | { type: "oauth_redirect"; url: string }
  // System
  | { type: "error"; message: string; code?: ErrorCode; fatal: boolean }
  | { type: "warning"; message: string }
  | { type: "stream_error"; message: string; retrying: boolean; attempt?: number }
  | { type: "shutdown_complete" };

// ── Supporting Types ──────────────────────────────────────────

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
  isBinary: boolean;
  truncated: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface ActiveTurnState {
  turnId: string;
  model: string;
  pendingApproval?: {
    type: "exec" | "patch" | "mcp_elicitation";
    callId: string;
  };
}

export interface McpServerStatus {
  name: string;
  status: "connected" | "failed";
  toolCount: number;
  error?: string;
}

export interface McpToolInfo {
  server: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: "global" | "project";
}

export interface ModelInfo {
  id: string;
  name: string;
  supportsReasoning: boolean;
  contextWindow: number;
}

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  workingDir: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  toolCalls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
  success: boolean;
  durationMs: number;
}

export interface SessionSnapshot {
  summary: SessionSummary;
  messages: ChatMessage[];
  workingDir: string;
  model: string;
  sandboxPolicy: string;
}
```

- [ ] **Step 4: Update index.ts**

`packages/shared-types/src/index.ts`:
```ts
export * from "./errors";
export * from "./config";
export * from "./tools";
export * from "./sandbox";
export * from "./auth";
export * from "./events";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd packages/shared-types && bun test && bunx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add WebSocket protocol types and session types"
```

---

## Task 5: shared-types — Skills Types

**Files:**
- Create: `packages/shared-types/src/skills.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Implement skill and plugin types**

`packages/shared-types/src/skills.ts`:
```ts
export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  trigger?: string;
  scope: "global" | "project";
  path: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  skills: SkillManifest[];
  mcpServers: PluginMcpServer[];
}

export interface PluginMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SkillRegistry {
  listSkills(workingDirs?: string[]): Promise<SkillManifest[]>;
  getSkill(id: string): Promise<SkillManifest | undefined>;
}
```

- [ ] **Step 2: Update index.ts**

Add to `packages/shared-types/src/index.ts`:
```ts
export * from "./skills";
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/shared-types && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add skill and plugin manifest types"
```

---

## Task 6: config Package — Zod Schema and Defaults

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/schema.ts`
- Create: `packages/config/src/defaults.ts`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/tests/schema.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/config/package.json`:
```json
{
  "name": "@clawdex/config",
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
    "@clawdex/shared-types": "workspace:*",
    "smol-toml": "^1.3.0",
    "zod": "^3.24.0"
  },
  "scripts": {
    "test": "bun test",
    "test:integration": "bun test --pattern '*.integration.test.ts'",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  }
}
```

`packages/config/tsconfig.json`:
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

Add reference to `tsconfig.build.json`:
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared-types" },
    { "path": "packages/config" }
  ]
}
```

Run: `pnpm install`

- [ ] **Step 2: Write failing test for schema validation**

`packages/config/tests/schema.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseConfig, configSchema } from "../src/schema";
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/config && bun test tests/schema.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement defaults**

`packages/config/src/defaults.ts`:
```ts
import type { ClawdexConfig } from "@clawdex/shared-types";

export const DEFAULT_CONFIG: ClawdexConfig = {
  model: "gpt-4o",
  model_reasoning_effort: "medium",
  model_context_window: 128_000,
  model_auto_compact_token_limit: 0.8,
  developer_instructions: "",
  approval_policy: "on-request",
  sandbox_mode: "workspace-write",
  auth: {
    api_key_env: "OPENAI_API_KEY",
    base_url: "https://api.openai.com/v1",
  },
  server: {
    host: "127.0.0.1",
    port: 3141,
    open_browser: true,
  },
  sandbox: {
    writable_roots: [],
    network_access: false,
  },
  mcp_servers: {},
  memories: {
    enabled: true,
  },
  skills: {
    enabled: true,
    search_paths: [],
  },
  plugins: {
    enabled: true,
  },
  history: {
    enabled: true,
    max_sessions: 100,
    max_session_age_days: 90,
  },
  notify: {
    command: "",
  },
  project_root_markers: [
    ".git",
    ".clawdex",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
  ],
};
```

- [ ] **Step 5: Implement Zod schema**

`packages/config/src/schema.ts`:
```ts
import { z } from "zod";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { DEFAULT_CONFIG } from "./defaults";

const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
  tools: z.record(z.object({ approval_mode: z.string().optional() })).optional(),
});

export const configSchema = z.object({
  model: z.string().default(DEFAULT_CONFIG.model),
  model_reasoning_effort: z
    .enum(["low", "medium", "high"])
    .default(DEFAULT_CONFIG.model_reasoning_effort),
  model_context_window: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_CONFIG.model_context_window),
  model_auto_compact_token_limit: z
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_CONFIG.model_auto_compact_token_limit),
  developer_instructions: z.string().default(""),
  approval_policy: z
    .enum(["on-request", "always", "never"])
    .default(DEFAULT_CONFIG.approval_policy),
  sandbox_mode: z
    .enum(["read-only", "workspace-write", "danger-full-access"])
    .default(DEFAULT_CONFIG.sandbox_mode),
  auth: z
    .object({
      api_key_env: z.string().default(DEFAULT_CONFIG.auth.api_key_env),
      base_url: z.string().url().default(DEFAULT_CONFIG.auth.base_url),
    })
    .default({}),
  server: z
    .object({
      host: z.string().default(DEFAULT_CONFIG.server.host),
      port: z.number().int().min(0).max(65535).default(DEFAULT_CONFIG.server.port),
      open_browser: z.boolean().default(DEFAULT_CONFIG.server.open_browser),
    })
    .default({}),
  sandbox: z
    .object({
      writable_roots: z.array(z.string()).default([]),
      network_access: z.boolean().default(false),
    })
    .default({}),
  mcp_servers: z.record(mcpServerSchema).default({}),
  memories: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  skills: z
    .object({
      enabled: z.boolean().default(true),
      search_paths: z.array(z.string()).default([]),
    })
    .default({}),
  plugins: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  history: z
    .object({
      enabled: z.boolean().default(true),
      max_sessions: z.number().int().positive().default(100),
      max_session_age_days: z.number().int().positive().default(90),
    })
    .default({}),
  notify: z
    .object({
      command: z.string().default(""),
    })
    .default({}),
  project_root_markers: z
    .array(z.string())
    .default(DEFAULT_CONFIG.project_root_markers),
});

export type ParseResult =
  | { success: true; data: ClawdexConfig }
  | { success: false; errors: z.ZodError };

export function parseConfig(raw: unknown): ParseResult {
  const result = configSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as ClawdexConfig };
  }
  return { success: false, errors: result.error };
}
```

`packages/config/src/index.ts`:
```ts
export { configSchema, parseConfig } from "./schema";
export type { ParseResult } from "./schema";
export { DEFAULT_CONFIG } from "./defaults";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/config && bun test tests/schema.test.ts`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/config/ tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(config): add Zod schema validation and default config"
```

---

## Task 7: config Package — File Discovery and Merge

**Files:**
- Create: `packages/config/src/loader.ts`
- Create: `packages/config/tests/loader.test.ts`
- Modify: `packages/config/src/index.ts`

- [ ] **Step 1: Write failing test for config loader**

`packages/config/tests/loader.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, findProjectRoot, mergeConfigs } from "../src/loader";

describe("mergeConfigs", () => {
  test("higher priority scalar wins", () => {
    const base = { model: "gpt-4o", server: { port: 3141 } };
    const override = { model: "gpt-4o-mini" };
    const result = mergeConfigs(base, override);
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.server.port).toBe(3141);
  });

  test("deep merges objects", () => {
    const base = { mcp_servers: { fs: { command: "npx", args: [] } } };
    const override = { mcp_servers: { gh: { command: "gh", args: ["mcp"] } } };
    const result = mergeConfigs(base, override);
    expect(result.mcp_servers.fs.command).toBe("npx");
    expect(result.mcp_servers.gh.command).toBe("gh");
  });

  test("arrays are replaced, not merged", () => {
    const base = { project_root_markers: [".git", "package.json"] };
    const override = { project_root_markers: [".hg"] };
    const result = mergeConfigs(base, override);
    expect(result.project_root_markers).toEqual([".hg"]);
  });
});

describe("findProjectRoot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("finds .git marker", async () => {
    const projectDir = join(tempDir, "project");
    const subDir = join(projectDir, "src", "lib");
    await mkdir(join(projectDir, ".git"), { recursive: true });
    await mkdir(subDir, { recursive: true });
    const root = await findProjectRoot(subDir, [".git", ".clawdex"]);
    expect(root).toBe(projectDir);
  });

  test("finds .clawdex marker", async () => {
    const projectDir = join(tempDir, "project");
    await mkdir(join(projectDir, ".clawdex"), { recursive: true });
    const root = await findProjectRoot(projectDir, [".git", ".clawdex"]);
    expect(root).toBe(projectDir);
  });

  test("returns cwd when no marker found", async () => {
    const root = await findProjectRoot(tempDir, [".nonexistent"]);
    expect(root).toBe(tempDir);
  });
});

describe("loadConfig", () => {
  let tempDir: string;
  let homeDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    homeDir = join(tempDir, "home");
    projectDir = join(tempDir, "project");
    await mkdir(join(homeDir, ".clawdex"), { recursive: true });
    await mkdir(join(projectDir, ".clawdex"), { recursive: true });
    await mkdir(join(projectDir, ".git"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("loads global config", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o-mini"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
    });
    expect(config.model).toBe("gpt-4o-mini");
  });

  test("project config overrides global", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o"\n',
    );
    await writeFile(
      join(projectDir, ".clawdex", "config.toml"),
      'model = "gpt-4o-mini"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
    });
    expect(config.model).toBe("gpt-4o-mini");
  });

  test("works with no config files", async () => {
    const emptyHome = join(tempDir, "empty-home");
    await mkdir(emptyHome, { recursive: true });
    const config = await loadConfig({
      homeDir: emptyHome,
      cwd: projectDir,
    });
    expect(config.model).toBe("gpt-4o");
  });

  test("CLI overrides take highest priority", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
      cliOverrides: { model: "o1" },
    });
    expect(config.model).toBe("o1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/config && bun test tests/loader.test.ts`
Expected: FAIL — module `../src/loader` does not exist.

- [ ] **Step 3: Implement config loader**

`packages/config/src/loader.ts`:
```ts
import { parse as parseTOML } from "smol-toml";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { ConfigError } from "@clawdex/shared-types";
import { parseConfig } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";

export function mergeConfigs(base: Record<string, any>, overlay: Record<string, any>): Record<string, any> {
  const result = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseVal = base[key];
    const overVal = overlay[key];
    if (
      overVal !== null &&
      typeof overVal === "object" &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      result[key] = mergeConfigs(baseVal, overVal);
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readTomlFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf-8");
    return parseTOML(content) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(
      `Failed to parse config: ${err instanceof Error ? err.message : String(err)}`,
      path,
    );
  }
}

export async function findProjectRoot(
  cwd: string,
  markers: string[],
): Promise<string> {
  let dir = resolve(cwd);
  const root = dirname(dir) === dir ? dir : undefined;

  while (true) {
    for (const marker of markers) {
      if (await fileExists(join(dir, marker))) {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir || parent === root) {
      return cwd;
    }
    dir = parent;
  }
}

export interface LoadConfigOptions {
  homeDir: string;
  cwd: string;
  cliOverrides?: Record<string, unknown>;
  envOverrides?: Record<string, unknown>;
}

export async function loadConfig(options: LoadConfigOptions): Promise<ClawdexConfig> {
  const { homeDir, cwd, cliOverrides, envOverrides } = options;

  // Layer 1: defaults
  let merged: Record<string, any> = { ...DEFAULT_CONFIG };

  // Layer 2: global config
  const globalPath = join(homeDir, ".clawdex", "config.toml");
  if (await fileExists(globalPath)) {
    const globalConfig = await readTomlFile(globalPath);
    merged = mergeConfigs(merged, globalConfig);
  }

  // Layer 3: project config
  const projectRoot = await findProjectRoot(
    cwd,
    merged.project_root_markers ?? DEFAULT_CONFIG.project_root_markers,
  );
  const projectPath = join(projectRoot, ".clawdex", "config.toml");
  if (await fileExists(projectPath)) {
    const projectConfig = await readTomlFile(projectPath);
    merged = mergeConfigs(merged, projectConfig);
  }

  // Layer 4: environment variable overrides
  if (envOverrides) {
    merged = mergeConfigs(merged, envOverrides);
  }

  // Layer 5: CLI overrides (highest priority)
  if (cliOverrides) {
    merged = mergeConfigs(merged, cliOverrides);
  }

  // Validate final merged config
  const result = parseConfig(merged);
  if (!result.success) {
    const firstError = result.errors.issues[0];
    throw new ConfigError(
      `Invalid config: ${firstError?.path.join(".")} — ${firstError?.message}`,
    );
  }

  return result.data;
}
```

- [ ] **Step 4: Update index.ts**

Add to `packages/config/src/index.ts`:
```ts
export { loadConfig, findProjectRoot, mergeConfigs } from "./loader";
export type { LoadConfigOptions } from "./loader";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/config && bun test tests/loader.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/config/
git commit -m "feat(config): add TOML file discovery, merge, and loading"
```

---

## Task 8: config Package — Environment Variable Mapping

**Files:**
- Create: `packages/config/src/env.ts`
- Create: `packages/config/tests/env.test.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `packages/config/src/loader.ts`

- [ ] **Step 1: Write failing test for env mapping**

`packages/config/tests/env.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { resolveEnvOverrides } from "../src/env";

describe("resolveEnvOverrides", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("maps CLAWDEX_MODEL to model", () => {
    process.env.CLAWDEX_MODEL = "gpt-4o-mini";
    const overrides = resolveEnvOverrides();
    expect(overrides.model).toBe("gpt-4o-mini");
  });

  test("maps CLAWDEX_PORT to server.port", () => {
    process.env.CLAWDEX_PORT = "8080";
    const overrides = resolveEnvOverrides();
    expect(overrides.server?.port).toBe(8080);
  });

  test("maps CLAWDEX_SANDBOX_MODE to sandbox_mode", () => {
    process.env.CLAWDEX_SANDBOX_MODE = "read-only";
    const overrides = resolveEnvOverrides();
    expect(overrides.sandbox_mode).toBe("read-only");
  });

  test("maps CLAWDEX_APPROVAL_POLICY", () => {
    process.env.CLAWDEX_APPROVAL_POLICY = "never";
    const overrides = resolveEnvOverrides();
    expect(overrides.approval_policy).toBe("never");
  });

  test("maps CLAWDEX_BASE_URL to auth.base_url", () => {
    process.env.CLAWDEX_BASE_URL = "http://localhost:4000/v1";
    const overrides = resolveEnvOverrides();
    expect(overrides.auth?.base_url).toBe("http://localhost:4000/v1");
  });

  test("returns empty object when no env vars set", () => {
    delete process.env.CLAWDEX_MODEL;
    delete process.env.CLAWDEX_PORT;
    delete process.env.CLAWDEX_SANDBOX_MODE;
    delete process.env.CLAWDEX_APPROVAL_POLICY;
    delete process.env.CLAWDEX_BASE_URL;
    delete process.env.CLAWDEX_HOST;
    const overrides = resolveEnvOverrides();
    expect(Object.keys(overrides).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/config && bun test tests/env.test.ts`
Expected: FAIL — module `../src/env` does not exist.

- [ ] **Step 3: Implement env mapping**

`packages/config/src/env.ts`:
```ts
interface EnvOverrides {
  model?: string;
  sandbox_mode?: string;
  approval_policy?: string;
  server?: { host?: string; port?: number };
  auth?: { base_url?: string };
}

const ENV_MAP: Array<{
  envVar: string;
  path: (value: string) => Partial<EnvOverrides>;
}> = [
  {
    envVar: "CLAWDEX_MODEL",
    path: (v) => ({ model: v }),
  },
  {
    envVar: "CLAWDEX_SANDBOX_MODE",
    path: (v) => ({ sandbox_mode: v }),
  },
  {
    envVar: "CLAWDEX_APPROVAL_POLICY",
    path: (v) => ({ approval_policy: v }),
  },
  {
    envVar: "CLAWDEX_HOST",
    path: (v) => ({ server: { host: v } }),
  },
  {
    envVar: "CLAWDEX_PORT",
    path: (v) => ({ server: { port: parseInt(v, 10) } }),
  },
  {
    envVar: "CLAWDEX_BASE_URL",
    path: (v) => ({ auth: { base_url: v } }),
  },
];

export function resolveEnvOverrides(): Record<string, any> {
  let result: Record<string, any> = {};

  for (const mapping of ENV_MAP) {
    const value = process.env[mapping.envVar];
    if (value !== undefined && value !== "") {
      const partial = mapping.path(value);
      result = deepMerge(result, partial as Record<string, any>);
    }
  }

  return result;
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
```

- [ ] **Step 4: Wire env overrides into loadConfig**

Update `packages/config/src/loader.ts` — modify the `loadConfig` function to auto-resolve env overrides when `envOverrides` is not explicitly provided:

Add import at top:
```ts
import { resolveEnvOverrides } from "./env";
```

In `loadConfig`, replace the environment variable section:
```ts
  // Layer 4: environment variable overrides
  const envLayer = envOverrides ?? resolveEnvOverrides();
  if (Object.keys(envLayer).length > 0) {
    merged = mergeConfigs(merged, envLayer);
  }
```

- [ ] **Step 5: Update index.ts**

Add to `packages/config/src/index.ts`:
```ts
export { resolveEnvOverrides } from "./env";
```

- [ ] **Step 6: Run all config tests**

Run: `cd packages/config && bun test`
Expected: all tests PASS (schema + loader + env).

- [ ] **Step 7: Commit**

```bash
git add packages/config/
git commit -m "feat(config): add environment variable mapping and auto-resolution"
```

---

## Task 9: auth Package — API Key Provider

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/api-key.ts`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/tests/api-key.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/auth/package.json`:
```json
{
  "name": "@clawdex/auth",
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

`packages/auth/tsconfig.json`:
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

Update `tsconfig.build.json`:
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared-types" },
    { "path": "packages/config" },
    { "path": "packages/auth" }
  ]
}
```

Run: `pnpm install`

- [ ] **Step 2: Write failing test**

`packages/auth/tests/api-key.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { ApiKeyAuthProvider } from "../src/api-key";
import { AuthError } from "@clawdex/shared-types";

describe("ApiKeyAuthProvider", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("reads API key from specified env var", async () => {
    process.env.MY_KEY = "sk-test-123";
    const provider = new ApiKeyAuthProvider("MY_KEY");
    const token = await provider.getToken();
    expect(token.token).toBe("sk-test-123");
    expect(token.expiresAt).toBeUndefined();
  });

  test("reports authenticated status", async () => {
    process.env.OPENAI_API_KEY = "sk-test-456";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(true);
    expect(status.method).toBe("api_key");
  });

  test("throws AuthError when key is missing", async () => {
    delete process.env.MISSING_KEY;
    const provider = new ApiKeyAuthProvider("MISSING_KEY");
    await expect(provider.getToken()).rejects.toThrow(AuthError);
  });

  test("reports unauthenticated when key is missing", async () => {
    delete process.env.MISSING_KEY;
    const provider = new ApiKeyAuthProvider("MISSING_KEY");
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });

  test("refresh returns same key", async () => {
    process.env.OPENAI_API_KEY = "sk-test-789";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    const token = await provider.refresh();
    expect(token.token).toBe("sk-test-789");
  });

  test("logout is a no-op for API key auth", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    await expect(provider.logout()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/auth && bun test`
Expected: FAIL — module `../src/api-key` does not exist.

- [ ] **Step 4: Implement API key provider**

`packages/auth/src/api-key.ts`:
```ts
import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";
import { AuthError } from "@clawdex/shared-types";

export class ApiKeyAuthProvider implements IAuthProvider {
  private readonly envVar: string;

  constructor(envVar: string) {
    this.envVar = envVar;
  }

  async getStatus(): Promise<AuthStatus> {
    const key = process.env[this.envVar];
    if (!key) {
      return { authenticated: false };
    }
    return { authenticated: true, method: "api_key" };
  }

  async getToken(): Promise<AuthToken> {
    const key = process.env[this.envVar];
    if (!key) {
      throw new AuthError(
        `API key not found. Set the ${this.envVar} environment variable.`,
      );
    }
    return { token: key };
  }

  async refresh(): Promise<AuthToken> {
    return this.getToken();
  }

  async logout(): Promise<void> {
    // No-op for API key auth — the key is in the environment
  }
}
```

- [ ] **Step 5: Create index.ts and OAuth stub**

`packages/auth/src/oauth.ts`:
```ts
import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";
import { AuthError } from "@clawdex/shared-types";

export class OAuthAuthProvider implements IAuthProvider {
  async getStatus(): Promise<AuthStatus> {
    return { authenticated: false };
  }

  async getToken(): Promise<AuthToken> {
    throw new AuthError("OAuth authentication is not yet implemented.");
  }

  async refresh(): Promise<AuthToken> {
    throw new AuthError("OAuth authentication is not yet implemented.");
  }

  async logout(): Promise<void> {
    // No-op
  }
}
```

`packages/auth/src/index.ts`:
```ts
import type { IAuthProvider } from "@clawdex/shared-types";
import { ApiKeyAuthProvider } from "./api-key";
import { OAuthAuthProvider } from "./oauth";

export { ApiKeyAuthProvider } from "./api-key";
export { OAuthAuthProvider } from "./oauth";

export type AuthMethod = "api_key" | "oauth";

export function createAuthProvider(method: AuthMethod, apiKeyEnv?: string): IAuthProvider {
  switch (method) {
    case "api_key":
      return new ApiKeyAuthProvider(apiKeyEnv ?? "OPENAI_API_KEY");
    case "oauth":
      return new OAuthAuthProvider();
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/auth && bun test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/ tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(auth): add API key provider and OAuth stub"
```

---

## Task 10: testkit Package — Mocks and Fixtures

**Files:**
- Create: `packages/testkit/package.json`
- Create: `packages/testkit/tsconfig.json`
- Create: `packages/testkit/src/mock-llm.ts`
- Create: `packages/testkit/src/mock-sandbox.ts`
- Create: `packages/testkit/src/fixtures.ts`
- Create: `packages/testkit/src/index.ts`
- Create: `packages/testkit/tests/mock-llm.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/testkit/package.json`:
```json
{
  "name": "@clawdex/testkit",
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

`packages/testkit/tsconfig.json`:
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

Update `tsconfig.build.json`:
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared-types" },
    { "path": "packages/config" },
    { "path": "packages/auth" },
    { "path": "packages/testkit" }
  ]
}
```

Run: `pnpm install`

- [ ] **Step 2: Write failing test for MockLLMClient**

`packages/testkit/tests/mock-llm.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { MockLLMClient } from "../src/mock-llm";

describe("MockLLMClient", () => {
  test("streams configured response chunks", async () => {
    const client = new MockLLMClient({
      responses: ["Hello", " world", "!"],
    });

    const chunks: string[] = [];
    for await (const chunk of client.stream("test prompt")) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world", "!"]);
  });

  test("returns configured tool calls", async () => {
    const client = new MockLLMClient({
      toolCalls: [
        { tool: "file_read", args: { path: "src/index.ts" } },
      ],
    });

    const result = await client.complete("test prompt");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].tool).toBe("file_read");
  });

  test("tracks call history", async () => {
    const client = new MockLLMClient({ responses: ["ok"] });

    for await (const _ of client.stream("first")) { /* consume */ }
    for await (const _ of client.stream("second")) { /* consume */ }

    expect(client.history).toHaveLength(2);
    expect(client.history[0]).toBe("first");
    expect(client.history[1]).toBe("second");
  });

  test("empty responses produces empty stream", async () => {
    const client = new MockLLMClient({ responses: [] });
    const chunks: string[] = [];
    for await (const chunk of client.stream("test")) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/testkit && bun test`
Expected: FAIL — module `../src/mock-llm` does not exist.

- [ ] **Step 4: Implement MockLLMClient**

`packages/testkit/src/mock-llm.ts`:
```ts
export interface MockToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface MockLLMResponse {
  message?: string;
  toolCalls?: MockToolCall[];
}

export interface MockLLMClientOptions {
  responses?: string[];
  toolCalls?: MockToolCall[];
}

export class MockLLMClient {
  private readonly responses: string[];
  private readonly toolCalls: MockToolCall[];
  readonly history: string[] = [];

  constructor(options: MockLLMClientOptions = {}) {
    this.responses = options.responses ?? [];
    this.toolCalls = options.toolCalls ?? [];
  }

  async *stream(prompt: string): AsyncGenerator<string> {
    this.history.push(prompt);
    for (const chunk of this.responses) {
      yield chunk;
    }
  }

  async complete(prompt: string): Promise<MockLLMResponse> {
    this.history.push(prompt);
    return {
      message: this.responses.join(""),
      toolCalls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
    };
  }
}
```

- [ ] **Step 5: Implement MockSandbox**

`packages/testkit/src/mock-sandbox.ts`:
```ts
import type { ISandbox, SandboxPolicy, SandboxCheckResult } from "@clawdex/shared-types";

export interface MockSandboxOptions {
  policy?: Partial<SandboxPolicy>;
  denyPatterns?: {
    fileRead?: string[];
    fileWrite?: string[];
    exec?: string[];
    network?: string[];
  };
}

export class MockSandbox implements ISandbox {
  readonly policy: SandboxPolicy;
  readonly checks: Array<{ type: string; target: string; result: SandboxCheckResult }> = [];
  private readonly denyPatterns: NonNullable<MockSandboxOptions["denyPatterns"]>;

  constructor(options: MockSandboxOptions = {}) {
    this.policy = {
      type: options.policy?.type ?? "workspace-write",
      writableRoots: options.policy?.writableRoots ?? ["/project"],
      networkAccess: options.policy?.networkAccess ?? false,
    };
    this.denyPatterns = options.denyPatterns ?? {};
  }

  checkFileRead(path: string): SandboxCheckResult {
    const result = this.check("fileRead", path, this.denyPatterns.fileRead);
    this.checks.push({ type: "fileRead", target: path, result });
    return result;
  }

  checkFileWrite(path: string): SandboxCheckResult {
    const result = this.check("fileWrite", path, this.denyPatterns.fileWrite);
    this.checks.push({ type: "fileWrite", target: path, result });
    return result;
  }

  checkExec(command: string): SandboxCheckResult {
    const result = this.check("exec", command, this.denyPatterns.exec);
    this.checks.push({ type: "exec", target: command, result });
    return result;
  }

  checkNetwork(host: string): SandboxCheckResult {
    const result = this.check("network", host, this.denyPatterns.network);
    this.checks.push({ type: "network", target: host, result });
    return result;
  }

  private check(_type: string, target: string, patterns?: string[]): SandboxCheckResult {
    if (!patterns || patterns.length === 0) {
      return { allowed: true };
    }
    for (const pattern of patterns) {
      if (target.includes(pattern)) {
        return { allowed: false, reason: `Denied by pattern: ${pattern}` };
      }
    }
    return { allowed: true };
  }
}
```

- [ ] **Step 6: Implement fixtures**

`packages/testkit/src/fixtures.ts`:
```ts
import type {
  ClawdexConfig,
  SessionSummary,
  ChatMessage,
  SessionSnapshot,
} from "@clawdex/shared-types";
import { DEFAULT_CONFIG } from "@clawdex/config";

export function createTestConfig(overrides?: Partial<ClawdexConfig>): ClawdexConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function createTestSession(overrides?: Partial<SessionSummary>): SessionSummary {
  return {
    id: "test-session-001",
    name: "Test Session",
    createdAt: "2026-04-04T10:00:00Z",
    lastActiveAt: "2026-04-04T10:30:00Z",
    messageCount: 2,
    workingDir: "/test/project",
    ...overrides,
  };
}

export function createTestMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-001",
    role: "user",
    content: "Hello, world!",
    timestamp: "2026-04-04T10:00:00Z",
    ...overrides,
  };
}

export function createTestSnapshot(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  const summary = createTestSession();
  return {
    summary,
    messages: [
      createTestMessage(),
      createTestMessage({
        id: "msg-002",
        role: "assistant",
        content: "Hello! How can I help you?",
        timestamp: "2026-04-04T10:00:05Z",
      }),
    ],
    workingDir: summary.workingDir,
    model: "gpt-4o",
    sandboxPolicy: "workspace-write",
    ...overrides,
  };
}
```

Note: `fixtures.ts` imports from `@clawdex/config`, so add it as a dependency:

Update `packages/testkit/package.json` dependencies:
```json
  "dependencies": {
    "@clawdex/shared-types": "workspace:*",
    "@clawdex/config": "workspace:*"
  },
```

Run: `pnpm install`

- [ ] **Step 7: Create index.ts**

`packages/testkit/src/index.ts`:
```ts
export { MockLLMClient } from "./mock-llm";
export type { MockLLMClientOptions, MockLLMResponse, MockToolCall } from "./mock-llm";

export { MockSandbox } from "./mock-sandbox";
export type { MockSandboxOptions } from "./mock-sandbox";

export {
  createTestConfig,
  createTestSession,
  createTestMessage,
  createTestSnapshot,
} from "./fixtures";
```

- [ ] **Step 8: Run tests and typecheck**

Run: `cd packages/testkit && bun test && bunx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 9: Run full workspace typecheck and tests**

Run from repo root:
```bash
pnpm typecheck && pnpm test
```
Expected: all packages pass typecheck and tests.

- [ ] **Step 10: Commit**

```bash
git add packages/testkit/ tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(testkit): add mock LLM client, mock sandbox, and test fixtures"
```

---

## Task 11: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify full workspace builds and typechecks**

```bash
pnpm typecheck
```
Expected: `tsc -b tsconfig.build.json` passes with no errors across all 4 packages.

- [ ] **Step 2: Verify all tests pass**

```bash
pnpm test
```
Expected: all test suites pass across shared-types, config, auth, testkit.

- [ ] **Step 3: Verify dependency graph is correct**

```bash
pnpm ls --depth=1 -r
```
Expected: Each package shows only its declared dependencies. No unexpected cross-references.

- [ ] **Step 4: Verify imports work across packages**

Create a quick smoke test (delete after verification):
```bash
cd packages/testkit && bun -e "
import { ClawdexError } from '@clawdex/shared-types';
import { DEFAULT_CONFIG } from '@clawdex/config';
import { ApiKeyAuthProvider } from '@clawdex/auth';
import { MockLLMClient, MockSandbox } from '@clawdex/testkit';

console.log('shared-types:', typeof ClawdexError);
console.log('config:', DEFAULT_CONFIG.model);
console.log('auth:', typeof ApiKeyAuthProvider);
console.log('testkit llm:', typeof MockLLMClient);
console.log('testkit sandbox:', typeof MockSandbox);
console.log('All imports OK');
"
```
Expected: prints all types correctly, "All imports OK".

- [ ] **Step 5: Commit any final adjustments**

If any fixes were needed during verification, commit them:
```bash
git add -A && git commit -m "fix: resolve Phase 1 integration issues"
```

Phase 1 is complete. The foundation packages are ready for Phase 2 (Tools & Sandbox).
