# Phase 3: Core Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `core` package — the engine that creates sessions, orchestrates conversation turns against the OpenAI streaming API, dispatches tool calls, persists sessions to disk, and emits events for every state change.

**Architecture:** Core is the orchestrator. It owns the `Session` class (conversation state, message history, token tracking) and the `TurnRunner` (streams one API turn: sends messages to OpenAI, processes streaming deltas, handles tool calls in a loop, emits events). Core depends on `tools`, `sandbox`, `config`, `auth`, and `shared-types`. It exposes a pure `EventEmitter` interface — no HTTP, no WS, just typed events that `server` will relay.

**Tech Stack:** TypeScript, Bun (runtime + test), native `fetch` for OpenAI streaming, `@clawdex/shared-types` (all types), `@clawdex/tools` (tool registry), `@clawdex/sandbox` (ISandbox), `@clawdex/config` (loadConfig), `@clawdex/auth` (IAuthProvider), `@clawdex/testkit` (mocks), `nanoid` (session IDs)

**Depends on:** Phase 1 (shared-types, config, auth, testkit) + Phase 2 (tools, sandbox)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md`

---

## File Structure

### packages/core/

```
packages/core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: ClawdexEngine, Session, types
│   ├── engine.ts                  ← ClawdexEngine: top-level orchestrator, session CRUD
│   ├── session.ts                 ← Session class: state, message history, token tracking
│   ├── turn-runner.ts             ← TurnRunner: one API turn loop (stream → tool calls → repeat)
│   ├── openai-stream.ts           ← OpenAI Responses API streaming via native fetch
│   ├── tool-dispatch.ts           ← Route tool calls to tool registry, collect results
│   ├── context-manager.ts         ← Context compaction + undo logic
│   ├── session-store.ts           ← File-based session persistence (JSON read/write)
│   ├── system-prompt.ts           ← Build system prompt from config + instructions + context
│   └── types.ts                   ← Internal types (EngineOptions, TurnState, etc.)
└── tests/
    ├── engine.test.ts             ← Engine creation, session CRUD
    ├── session.test.ts            ← Session state management
    ├── turn-runner.test.ts        ← Turn loop with mock LLM
    ├── openai-stream.test.ts      ← Stream parsing, error handling
    ├── tool-dispatch.test.ts      ← Tool routing, result collection
    ├── context-manager.test.ts    ← Compact + undo
    └── session-store.test.ts      ← Persist + load sessions
```

---

## Task 1: Package Scaffolding + Internal Types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`
- Modify: `tsconfig.build.json` (add core reference)

- [ ] **Step 1: Create package.json**

`packages/core/package.json`:
```json
{
  "name": "@clawdex/core",
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
    "@clawdex/config": "workspace:*",
    "@clawdex/auth": "workspace:*",
    "@clawdex/tools": "workspace:*",
    "@clawdex/sandbox": "workspace:*",
    "nanoid": "^5.1.5"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`packages/core/tsconfig.json`:
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
    { "path": "../tools" },
    { "path": "../sandbox" }
  ]
}
```

- [ ] **Step 3: Create internal types**

`packages/core/src/types.ts`:
```typescript
import type {
  ClawdexConfig,
  IAuthProvider,
  ISandbox,
  TokenUsage,
  ChatMessage,
  SessionSnapshot,
  SessionSummary,
  FileDiff,
  ActiveTurnState,
} from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";

/** Options for creating a ClawdexEngine instance. */
export interface EngineOptions {
  config: ClawdexConfig;
  authProvider: IAuthProvider;
  sandbox: ISandbox;
  toolRegistry: ToolRegistry;
  /** Base directory for session storage. Defaults to ~/.clawdex/sessions/ */
  sessionsDir?: string;
}

/** Internal state of a turn in progress. */
export interface TurnState {
  turnId: string;
  model: string;
  /** Messages sent to OpenAI for this turn (includes history + new user message). */
  inputMessages: OpenAIMessage[];
  /** Whether we're waiting for user approval before continuing. */
  pendingApproval: PendingApproval | null;
  /** Accumulated token usage for this turn. */
  usage: TokenUsage;
  /** Whether the turn has been interrupted by the user. */
  interrupted: boolean;
  /** Tool calls made during this turn, for undo tracking. */
  filesModified: Set<string>;
}

export interface PendingApproval {
  type: "exec" | "patch" | "mcp_elicitation";
  callId: string;
  resolve: (decision: "approve" | "deny") => void;
}

/** Minimal OpenAI message format for the Responses API. */
export type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; tool_call_id: string; content: string };

/** Parsed streaming event from OpenAI SSE. */
export type OpenAIStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.reasoning_summary_text.delta"; delta: string }
  | { type: "response.output_text.done"; text: string }
  | { type: "response.reasoning_summary_text.done"; text: string }
  | { type: "response.function_call_arguments.delta"; call_id: string; delta: string }
  | { type: "response.function_call_arguments.done"; call_id: string; name: string; arguments: string }
  | { type: "response.completed"; usage: { input_tokens: number; output_tokens: number } }
  | { type: "response.error"; message: string }
  | { type: "response.done" };

/** Options for a single turn execution. */
export interface TurnOptions {
  prompt: string;
  model?: string;
  effort?: "low" | "medium" | "high";
}

/** Persisted session file format (v1). */
export interface SessionFile {
  version: 1;
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  workingDir: string;
  model: string;
  sandboxPolicy: string;
  messages: ChatMessage[];
  tokenUsage: TokenUsage;
  diffs: FileDiff[];
}
```

- [ ] **Step 4: Create index.ts with placeholder exports**

`packages/core/src/index.ts`:
```typescript
export { ClawdexEngine } from "./engine.js";
export { Session } from "./session.js";
export type {
  EngineOptions,
  TurnOptions,
  TurnState,
  SessionFile,
} from "./types.js";
```

- [ ] **Step 5: Add core to tsconfig.build.json**

Add `{ "path": "packages/core" }` to the `references` array in `tsconfig.build.json`.

- [ ] **Step 6: Install dependencies and verify typecheck**

Run:
```bash
pnpm install
cd packages/core && pnpm typecheck
```

Expected: may have errors about missing modules (engine.ts, session.ts) — that's fine, we'll create them next.

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/src/types.ts packages/core/src/index.ts tsconfig.build.json
git commit -m "feat(core): scaffold package with internal types"
```

---

## Task 2: Session Class — State Management

**Files:**
- Create: `packages/core/src/session.ts`
- Create: `packages/core/tests/session.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/session.test.ts`:
```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { Session } from "../src/session.js";
import type { ChatMessage, TokenUsage } from "@clawdex/shared-types";

describe("Session", () => {
  let session: Session;

  beforeEach(() => {
    session = new Session({
      workingDir: "/tmp/test-project",
      model: "gpt-4o",
      sandboxPolicy: "workspace-write",
    });
  });

  test("generates a 12-char nanoid as id", () => {
    expect(session.id).toHaveLength(12);
    expect(session.id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  test("initializes with empty messages and zero usage", () => {
    expect(session.messages).toEqual([]);
    expect(session.tokenUsage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  test("addMessage appends and updates lastActiveAt", () => {
    const before = session.lastActiveAt;
    const msg: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: new Date().toISOString(),
    };
    session.addMessage(msg);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toEqual(msg);
    expect(session.lastActiveAt >= before).toBe(true);
  });

  test("addTokenUsage accumulates correctly", () => {
    session.addTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
    session.addTokenUsage({ inputTokens: 200, outputTokens: 100, totalTokens: 300 });
    expect(session.tokenUsage).toEqual({
      inputTokens: 300,
      outputTokens: 150,
      totalTokens: 450,
    });
  });

  test("setName updates the session name", () => {
    expect(session.name).toBeUndefined();
    session.setName("my session");
    expect(session.name).toBe("my session");
  });

  test("toSnapshot returns a complete SessionSnapshot", () => {
    session.setName("test");
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hi",
      timestamp: new Date().toISOString(),
    });
    const snap = session.toSnapshot();
    expect(snap.summary.id).toBe(session.id);
    expect(snap.summary.name).toBe("test");
    expect(snap.summary.messageCount).toBe(1);
    expect(snap.messages).toHaveLength(1);
    expect(snap.workingDir).toBe("/tmp/test-project");
    expect(snap.model).toBe("gpt-4o");
    expect(snap.sandboxPolicy).toBe("workspace-write");
  });

  test("toSummary returns minimal session info", () => {
    const summary = session.toSummary();
    expect(summary.id).toBe(session.id);
    expect(summary.messageCount).toBe(0);
    expect(summary.workingDir).toBe("/tmp/test-project");
  });

  test("popLastTurnMessages removes messages from the last turn", () => {
    session.addMessage({
      id: "msg-1", role: "user", content: "first",
      timestamp: new Date().toISOString(), turnId: "turn-1",
    });
    session.addMessage({
      id: "msg-2", role: "assistant", content: "reply to first",
      timestamp: new Date().toISOString(), turnId: "turn-1",
    });
    session.addMessage({
      id: "msg-3", role: "user", content: "second",
      timestamp: new Date().toISOString(), turnId: "turn-2",
    });
    session.addMessage({
      id: "msg-4", role: "assistant", content: "reply to second",
      timestamp: new Date().toISOString(), turnId: "turn-2",
    });

    const removed = session.popLastTurnMessages();
    expect(removed).toHaveLength(2);
    expect(removed[0].turnId).toBe("turn-2");
    expect(session.messages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/session.test.ts`
Expected: FAIL — `Session` not found.

- [ ] **Step 3: Write the Session class**

`packages/core/src/session.ts`:
```typescript
import { nanoid } from "nanoid";
import type {
  ChatMessage,
  TokenUsage,
  SessionSnapshot,
  SessionSummary,
  FileDiff,
} from "@clawdex/shared-types";

export interface SessionCreateOptions {
  workingDir: string;
  model: string;
  sandboxPolicy: string;
  id?: string;
  name?: string;
  createdAt?: string;
}

export class Session {
  readonly id: string;
  readonly createdAt: string;
  readonly workingDir: string;
  model: string;
  sandboxPolicy: string;
  name?: string;
  lastActiveAt: string;

  private _messages: ChatMessage[] = [];
  private _tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private _diffs: FileDiff[] = [];

  constructor(opts: SessionCreateOptions) {
    this.id = opts.id ?? nanoid(12);
    this.createdAt = opts.createdAt ?? new Date().toISOString();
    this.lastActiveAt = this.createdAt;
    this.workingDir = opts.workingDir;
    this.model = opts.model;
    this.sandboxPolicy = opts.sandboxPolicy;
    this.name = opts.name;
  }

  get messages(): readonly ChatMessage[] {
    return this._messages;
  }

  get tokenUsage(): TokenUsage {
    return { ...this._tokenUsage };
  }

  get diffs(): readonly FileDiff[] {
    return this._diffs;
  }

  addMessage(msg: ChatMessage): void {
    this._messages.push(msg);
    this.lastActiveAt = new Date().toISOString();
  }

  addTokenUsage(usage: TokenUsage): void {
    this._tokenUsage.inputTokens += usage.inputTokens;
    this._tokenUsage.outputTokens += usage.outputTokens;
    this._tokenUsage.totalTokens += usage.totalTokens;
  }

  addDiffs(diffs: FileDiff[]): void {
    this._diffs.push(...diffs);
  }

  setName(name: string): void {
    this.name = name;
  }

  /** Replace entire message history (used by compact). */
  replaceMessages(messages: ChatMessage[]): void {
    this._messages = [...messages];
  }

  /** Remove and return all messages belonging to the most recent turnId. */
  popLastTurnMessages(): ChatMessage[] {
    if (this._messages.length === 0) return [];

    // Find the last turnId
    let lastTurnId: string | undefined;
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].turnId) {
        lastTurnId = this._messages[i].turnId;
        break;
      }
    }
    if (!lastTurnId) return [];

    const removed: ChatMessage[] = [];
    this._messages = this._messages.filter((m) => {
      if (m.turnId === lastTurnId) {
        removed.push(m);
        return false;
      }
      return true;
    });
    return removed;
  }

  toSnapshot(): SessionSnapshot {
    return {
      summary: this.toSummary(),
      messages: [...this._messages],
      workingDir: this.workingDir,
      model: this.model,
      sandboxPolicy: this.sandboxPolicy,
    };
  }

  toSummary(): SessionSummary {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      messageCount: this._messages.length,
      workingDir: this.workingDir,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/session.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session.ts packages/core/tests/session.test.ts
git commit -m "feat(core): add Session class with state management"
```

---

## Task 3: Session Store — File-Based Persistence

**Files:**
- Create: `packages/core/src/session-store.ts`
- Create: `packages/core/tests/session-store.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/session-store.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../src/session-store.js";
import { Session } from "../src/session.js";

describe("SessionStore", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-session-store-"));
    store = new SessionStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save and load round-trips a session", async () => {
    const session = new Session({
      workingDir: "/tmp/project",
      model: "gpt-4o",
      sandboxPolicy: "workspace-write",
    });
    session.setName("my session");
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: "2026-04-04T10:00:00Z",
    });
    session.addTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });

    await store.save(session);
    const loaded = await store.load(session.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
    expect(loaded!.name).toBe("my session");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.workingDir).toBe("/tmp/project");
    expect(loaded!.model).toBe("gpt-4o");
  });

  test("load returns null for nonexistent session", async () => {
    const loaded = await store.load("nonexistent");
    expect(loaded).toBeNull();
  });

  test("list returns summaries of all sessions", async () => {
    const s1 = new Session({ workingDir: "/a", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    const s2 = new Session({ workingDir: "/b", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    s1.setName("first");
    s2.setName("second");

    await store.save(s1);
    await store.save(s2);

    const list = await store.list();
    expect(list).toHaveLength(2);
    const names = list.map((s) => s.name).sort();
    expect(names).toEqual(["first", "second"]);
  });

  test("delete removes a session file", async () => {
    const session = new Session({ workingDir: "/a", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    await store.save(session);
    await store.delete(session.id);
    const loaded = await store.load(session.id);
    expect(loaded).toBeNull();
  });

  test("prune removes sessions beyond maxSessions", async () => {
    // Create 3 sessions with staggered timestamps
    for (let i = 0; i < 3; i++) {
      const s = new Session({
        workingDir: "/tmp",
        model: "gpt-4o",
        sandboxPolicy: "workspace-write",
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      });
      s.setName(`session-${i}`);
      await store.save(s);
    }

    await store.prune({ maxSessions: 2 });
    const list = await store.list();
    expect(list).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/session-store.test.ts`
Expected: FAIL — `SessionStore` not found.

- [ ] **Step 3: Write the SessionStore**

`packages/core/src/session-store.ts`:
```typescript
import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Session } from "./session.js";
import type { SessionFile } from "./types.js";
import type { SessionSummary } from "@clawdex/shared-types";

export class SessionStore {
  constructor(private readonly dir: string) {}

  /** Ensure the sessions directory exists. */
  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  /** Persist a session to disk using atomic write (write tmp, rename). */
  async save(session: Session): Promise<void> {
    await this.ensureDir();
    const file: SessionFile = {
      version: 1,
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      workingDir: session.workingDir,
      model: session.model,
      sandboxPolicy: session.sandboxPolicy,
      messages: [...session.messages],
      tokenUsage: session.tokenUsage,
      diffs: [...session.diffs],
    };
    const json = JSON.stringify(file, null, 2);
    const tmpPath = this.filePath(session.id) + ".tmp";
    await writeFile(tmpPath, json, "utf-8");
    // Atomic rename
    const { rename } = await import("node:fs/promises");
    await rename(tmpPath, this.filePath(session.id));
  }

  /** Load a session from disk. Returns null if not found. */
  async load(id: string): Promise<Session | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf-8");
      const file: SessionFile = JSON.parse(raw);
      const session = new Session({
        id: file.id,
        workingDir: file.workingDir,
        model: file.model,
        sandboxPolicy: file.sandboxPolicy,
        name: file.name,
        createdAt: file.createdAt,
      });
      for (const msg of file.messages) {
        session.addMessage(msg);
      }
      if (file.tokenUsage) {
        session.addTokenUsage(file.tokenUsage);
      }
      if (file.diffs) {
        session.addDiffs(file.diffs);
      }
      return session;
    } catch {
      return null;
    }
  }

  /** List summaries of all sessions on disk. */
  async list(): Promise<SessionSummary[]> {
    await this.ensureDir();
    const files = await readdir(this.dir);
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.dir, file), "utf-8");
        const data: SessionFile = JSON.parse(raw);
        summaries.push({
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          lastActiveAt: data.lastActiveAt,
          messageCount: data.messages.length,
          workingDir: data.workingDir,
        });
      } catch {
        // Skip corrupted files
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  /** Delete a session file from disk. */
  async delete(id: string): Promise<void> {
    try {
      await unlink(this.filePath(id));
    } catch {
      // Already deleted or never existed
    }
  }

  /** Prune old sessions beyond limits. Keeps most recent. */
  async prune(opts: { maxSessions?: number; maxAgeDays?: number }): Promise<void> {
    const summaries = await this.list();

    // Filter by age first
    if (opts.maxAgeDays !== undefined) {
      const cutoff = Date.now() - opts.maxAgeDays * 86_400_000;
      for (const s of summaries) {
        if (new Date(s.lastActiveAt).getTime() < cutoff) {
          await this.delete(s.id);
        }
      }
    }

    // Then enforce max count (list is already sorted by lastActiveAt desc)
    if (opts.maxSessions !== undefined) {
      const remaining = await this.list();
      if (remaining.length > opts.maxSessions) {
        const toDelete = remaining.slice(opts.maxSessions);
        for (const s of toDelete) {
          await this.delete(s.id);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/session-store.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session-store.ts packages/core/tests/session-store.test.ts
git commit -m "feat(core): add SessionStore for file-based persistence"
```

---

## Task 4: OpenAI Streaming — SSE Parser

**Files:**
- Create: `packages/core/src/openai-stream.ts`
- Create: `packages/core/tests/openai-stream.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/openai-stream.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import {
  parseSSELine,
  createOpenAIStream,
  type OpenAIStreamConfig,
} from "../src/openai-stream.js";
import type { OpenAIStreamEvent } from "../src/types.js";

describe("parseSSELine", () => {
  test("parses a data line into JSON", () => {
    const event = parseSSELine(
      'data: {"type":"response.output_text.delta","delta":"Hello"}'
    );
    expect(event).toEqual({ type: "response.output_text.delta", delta: "Hello" });
  });

  test("returns null for empty lines", () => {
    expect(parseSSELine("")).toBeNull();
    expect(parseSSELine("\n")).toBeNull();
  });

  test("returns done event for [DONE]", () => {
    expect(parseSSELine("data: [DONE]")).toEqual({ type: "response.done" });
  });

  test("returns null for comment lines", () => {
    expect(parseSSELine(": keep-alive")).toBeNull();
  });

  test("returns null for non-data lines", () => {
    expect(parseSSELine("event: message")).toBeNull();
  });
});

describe("createOpenAIStream", () => {
  function mockFetchResponse(events: string[]): () => Promise<Response> {
    return async () => {
      const body = events.join("\n\n") + "\n\n";
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };
  }

  test("streams text deltas from SSE events", async () => {
    const events = [
      'data: {"type":"response.output_text.delta","delta":"Hello "}',
      'data: {"type":"response.output_text.delta","delta":"world"}',
      'data: {"type":"response.output_text.done","text":"Hello world"}',
      'data: {"type":"response.completed","usage":{"input_tokens":10,"output_tokens":5}}',
      "data: [DONE]",
    ];

    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetchResponse(events));
    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toHaveLength(5);
    expect(collected[0]).toEqual({ type: "response.output_text.delta", delta: "Hello " });
    expect(collected[3]).toEqual({
      type: "response.completed",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(collected[4]).toEqual({ type: "response.done" });
  });

  test("yields error event on non-200 response", async () => {
    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    const mockFetch = async () =>
      new Response('{"error":{"message":"Rate limited"}}', { status: 429 });

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetch);
    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toHaveLength(1);
    expect(collected[0].type).toBe("response.error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/openai-stream.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the OpenAI stream module**

`packages/core/src/openai-stream.ts`:
```typescript
import type { OpenAIStreamEvent, OpenAIMessage } from "./types.js";
import type { ToolSchema } from "@clawdex/shared-types";

export interface OpenAIStreamConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
  tools: ToolSchema[];
  reasoningEffort?: "low" | "medium" | "high";
}

/** Parse a single SSE line into a typed event (or null if not a data line). */
export function parseSSELine(line: string): OpenAIStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) {
    return null;
  }

  const payload = trimmed.slice(6); // Remove "data: "
  if (payload === "[DONE]") {
    return { type: "response.done" };
  }

  try {
    return JSON.parse(payload) as OpenAIStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Create an async generator that streams OpenAI Responses API events.
 * Accepts an optional fetchFn override for testing.
 */
export async function* createOpenAIStream(
  config: OpenAIStreamConfig,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
): AsyncGenerator<OpenAIStreamEvent> {
  const url = `${config.baseUrl}/responses`;

  const toolDefs = config.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const body = JSON.stringify({
    model: config.model,
    input: config.messages.map((m) => {
      if (m.role === "tool") {
        return { type: "function_call_output", call_id: m.tool_call_id, output: m.content };
      }
      return { role: m.role, content: m.content };
    }),
    tools: toolDefs.length > 0 ? toolDefs : undefined,
    stream: true,
    ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
  });

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    let message = `OpenAI API error: ${response.status}`;
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // Use status code message
    }
    yield { type: "response.error", message };
    return;
  }

  if (!response.body) {
    yield { type: "response.error", message: "No response body" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");
      // Keep the last (possibly incomplete) part in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          const event = parseSSELine(line);
          if (event) {
            yield event;
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const event = parseSSELine(line);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/openai-stream.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/openai-stream.ts packages/core/tests/openai-stream.test.ts
git commit -m "feat(core): add OpenAI SSE streaming parser"
```

---

## Task 5: System Prompt Builder

**Files:**
- Create: `packages/core/src/system-prompt.ts`
- Create: `packages/core/tests/system-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/system-prompt.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../src/system-prompt.js";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { createTestConfig } from "@clawdex/testkit";

describe("buildSystemPrompt", () => {
  test("includes model name and working directory", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/home/user/project",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).toContain("gpt-4o");
    expect(prompt).toContain("/home/user/project");
  });

  test("includes developer instructions when set", () => {
    const config = createTestConfig({ developer_instructions: "Always use TypeScript" });
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).toContain("Always use TypeScript");
  });

  test("omits developer instructions when empty", () => {
    const config = createTestConfig({ developer_instructions: "" });
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).not.toContain("Developer Instructions");
  });

  test("includes sandbox policy", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "read-only",
    });
    expect(prompt).toContain("read-only");
  });

  test("includes platform info", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    // Should include the current platform
    expect(prompt).toContain(process.platform);
  });

  test("includes current date", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(prompt).toContain(today);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/system-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the system prompt builder**

`packages/core/src/system-prompt.ts`:
```typescript
import type { ClawdexConfig } from "@clawdex/shared-types";

export interface SystemPromptOptions {
  config: ClawdexConfig;
  model: string;
  workingDir: string;
  sandboxPolicy: string;
  /** Additional context from memories, skills, etc. */
  additionalContext?: string;
}

export function buildSystemPrompt(opts: SystemPromptOptions): string {
  const { config, model, workingDir, sandboxPolicy, additionalContext } = opts;
  const today = new Date().toISOString().slice(0, 10);

  const sections: string[] = [];

  sections.push(
    `You are a coding assistant powered by ${model}.`,
    "",
    "## Environment",
    `- Working directory: ${workingDir}`,
    `- Platform: ${process.platform}`,
    `- Date: ${today}`,
    `- Sandbox policy: ${sandboxPolicy}`,
  );

  if (config.developer_instructions) {
    sections.push(
      "",
      "## Developer Instructions",
      config.developer_instructions,
    );
  }

  sections.push(
    "",
    "## Tools",
    "You have access to tools for reading files, writing files, running shell commands, and applying patches.",
    "Use tools to accomplish the user's requests. Always verify your work.",
  );

  if (sandboxPolicy === "read-only") {
    sections.push(
      "",
      "## Sandbox Restrictions",
      "You are in read-only mode. You may read files and run safe commands but cannot write files or execute destructive operations.",
    );
  }

  if (additionalContext) {
    sections.push("", additionalContext);
  }

  return sections.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/system-prompt.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/system-prompt.ts packages/core/tests/system-prompt.test.ts
git commit -m "feat(core): add system prompt builder"
```

---

## Task 6: Tool Dispatch — Route Tool Calls to Registry

**Files:**
- Create: `packages/core/src/tool-dispatch.ts`
- Create: `packages/core/tests/tool-dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/tool-dispatch.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { dispatchToolCall } from "../src/tool-dispatch.js";
import type { ITool, ToolCall, ToolResult, ToolContext, ISandbox } from "@clawdex/shared-types";
import { ToolRegistry } from "@clawdex/tools";
import { MockSandbox } from "@clawdex/testkit";

function createMockTool(name: string, handler: (args: Record<string, unknown>) => string): ITool {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: { type: "object", properties: {} },
    execute: async (call: ToolCall, ctx: ToolContext): Promise<ToolResult> => {
      return {
        callId: call.callId,
        output: handler(call.args),
        success: true,
      };
    },
  };
}

describe("dispatchToolCall", () => {
  test("dispatches to the correct tool by name", async () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("file-read", () => "file contents"));
    registry.register(createMockTool("shell", () => "shell output"));

    const call: ToolCall = {
      callId: "call-1",
      tool: "file-read",
      args: { path: "/tmp/test.txt" },
    };
    const ctx: ToolContext = {
      workingDir: "/tmp",
      sandbox: new MockSandbox(),
    };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("file contents");
    expect(result.callId).toBe("call-1");
  });

  test("returns error result for unknown tool", async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = {
      callId: "call-2",
      tool: "unknown-tool",
      args: {},
    };
    const ctx: ToolContext = {
      workingDir: "/tmp",
      sandbox: new MockSandbox(),
    };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("unknown-tool");
  });

  test("catches tool execution errors and returns failure result", async () => {
    const registry = new ToolRegistry();
    const failingTool: ITool = {
      name: "failing",
      description: "always fails",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        throw new Error("boom");
      },
    };
    registry.register(failingTool);

    const call: ToolCall = { callId: "call-3", tool: "failing", args: {} };
    const ctx: ToolContext = { workingDir: "/tmp", sandbox: new MockSandbox() };

    const result = await dispatchToolCall(registry, call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/tool-dispatch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the tool dispatch module**

`packages/core/src/tool-dispatch.ts`:
```typescript
import type { ToolCall, ToolResult, ToolContext } from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";

/**
 * Dispatch a single tool call to the matching tool in the registry.
 * Returns a ToolResult — never throws.
 */
export async function dispatchToolCall(
  registry: ToolRegistry,
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = registry.get(call.tool);

  if (!tool) {
    return {
      callId: call.callId,
      output: `Tool not found: ${call.tool}`,
      success: false,
    };
  }

  try {
    return await tool.execute(call, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      callId: call.callId,
      output: `Tool execution error: ${message}`,
      success: false,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/tool-dispatch.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tool-dispatch.ts packages/core/tests/tool-dispatch.test.ts
git commit -m "feat(core): add tool dispatch routing"
```

---

## Task 7: Context Manager — Compact + Undo

**Files:**
- Create: `packages/core/src/context-manager.ts`
- Create: `packages/core/tests/context-manager.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/context-manager.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { shouldAutoCompact, buildCompactPrompt, estimateTokens } from "../src/context-manager.js";
import type { ChatMessage } from "@clawdex/shared-types";

describe("estimateTokens", () => {
  test("estimates ~4 chars per token", () => {
    const text = "a".repeat(400);
    const tokens = estimateTokens(text);
    expect(tokens).toBeCloseTo(100, -1); // ~100 tokens, allow rough estimate
  });

  test("handles empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("shouldAutoCompact", () => {
  test("returns true when token count exceeds threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 105_000,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(true);
  });

  test("returns false when under threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 50_000,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(false);
  });

  test("returns false at exact threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 102_400,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(false);
  });
});

describe("buildCompactPrompt", () => {
  test("includes message history in compact prompt", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Write a function", timestamp: "2026-01-01T00:00:00Z" },
      { id: "2", role: "assistant", content: "Here is the function...", timestamp: "2026-01-01T00:01:00Z" },
    ];
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain("Write a function");
    expect(prompt).toContain("Here is the function");
    expect(prompt).toContain("summary");
  });

  test("handles empty messages", () => {
    const prompt = buildCompactPrompt([]);
    expect(prompt).toContain("summary");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/context-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the context manager**

`packages/core/src/context-manager.ts`:
```typescript
import type { ChatMessage } from "@clawdex/shared-types";

/**
 * Rough token estimate: ~4 characters per token.
 * Good enough for compaction threshold checks without a tokenizer dependency.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Check whether the session should be auto-compacted. */
export function shouldAutoCompact(opts: {
  totalTokens: number;
  contextWindow: number;
  compactThreshold: number;
}): boolean {
  const limit = opts.contextWindow * opts.compactThreshold;
  return opts.totalTokens > limit;
}

/** Build the prompt sent to the LLM to request a conversation summary. */
export function buildCompactPrompt(messages: readonly ChatMessage[]): string {
  const history = messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n\n");

  return [
    "Please provide a concise summary of the following conversation.",
    "Focus on: what was accomplished, what files were changed, key decisions made,",
    "and any pending work. Keep it under 500 words.",
    "",
    "---",
    history || "(empty conversation)",
    "---",
    "",
    "Provide the summary below:",
  ].join("\n");
}

/**
 * Build a compacted message list: replace all messages with a single
 * system message containing the summary, preserving the last user message.
 */
export function compactMessages(
  summary: string,
  lastUserMessage?: ChatMessage,
): ChatMessage[] {
  const result: ChatMessage[] = [
    {
      id: "compact-summary",
      role: "system",
      content: `[Previous conversation summary]\n\n${summary}`,
      timestamp: new Date().toISOString(),
    },
  ];
  if (lastUserMessage) {
    result.push(lastUserMessage);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/context-manager.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context-manager.ts packages/core/tests/context-manager.test.ts
git commit -m "feat(core): add context manager (compact + token estimation)"
```

---

## Task 8: TurnRunner — Streaming Turn Loop

**Files:**
- Create: `packages/core/src/turn-runner.ts`
- Create: `packages/core/tests/turn-runner.test.ts`

This is the central piece: it runs one conversation turn — sends messages to OpenAI, processes streaming deltas, dispatches tool calls in a loop, and emits events.

- [ ] **Step 1: Write the failing test**

`packages/core/tests/turn-runner.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { TurnRunner } from "../src/turn-runner.js";
import type { EventMsg, ToolSchema } from "@clawdex/shared-types";
import type { OpenAIStreamEvent } from "../src/types.js";
import { ToolRegistry } from "@clawdex/tools";
import { MockSandbox } from "@clawdex/testkit";

/** Helper: build a mock stream function that yields canned events. */
function mockStreamFn(events: OpenAIStreamEvent[]) {
  return async function* () {
    for (const e of events) {
      yield e;
    }
  };
}

describe("TurnRunner", () => {
  test("emits turn_started, agent_message_delta, agent_message, turn_complete for a simple text response", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.output_text.delta", delta: "Hello " },
      { type: "response.output_text.delta", delta: "world" },
      { type: "response.output_text.done", text: "Hello world" },
      { type: "response.completed", usage: { input_tokens: 10, output_tokens: 5 } },
      { type: "response.done" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-1",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("turn_started");
    expect(types).toContain("agent_message_delta");
    expect(types).toContain("agent_message");
    expect(types).toContain("turn_complete");

    // Check delta contents
    const deltas = emitted
      .filter((e): e is EventMsg & { type: "agent_message_delta" } => e.type === "agent_message_delta");
    expect(deltas).toHaveLength(2);

    // Check final message
    const msg = emitted.find((e) => e.type === "agent_message") as any;
    expect(msg.message).toBe("Hello world");

    // Check usage in turn_complete
    const complete = emitted.find((e) => e.type === "turn_complete") as any;
    expect(complete.usage.inputTokens).toBe(10);
    expect(complete.usage.outputTokens).toBe(5);
  });

  test("dispatches tool calls and feeds results back", async () => {
    // First stream: LLM requests a tool call
    const stream1: OpenAIStreamEvent[] = [
      { type: "response.function_call_arguments.done", call_id: "call-1", name: "file-read", arguments: '{"path":"/tmp/x.txt"}' },
      { type: "response.completed", usage: { input_tokens: 20, output_tokens: 10 } },
      { type: "response.done" },
    ];

    // Second stream: LLM produces final text
    const stream2: OpenAIStreamEvent[] = [
      { type: "response.output_text.done", text: "File says hello" },
      { type: "response.completed", usage: { input_tokens: 30, output_tokens: 15 } },
      { type: "response.done" },
    ];

    let streamCall = 0;
    const createStream = async function* () {
      const events = streamCall === 0 ? stream1 : stream2;
      streamCall++;
      for (const e of events) {
        yield e;
      }
    };

    // Register a mock file-read tool
    const registry = new ToolRegistry();
    registry.register({
      name: "file-read",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      execute: async (call) => ({
        callId: call.callId,
        output: "hello from file",
        success: true,
      }),
    });

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-2",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: registry,
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream,
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("tool_call_begin");
    expect(types).toContain("tool_call_end");
    expect(types).toContain("turn_complete");
  });

  test("emits turn_aborted on stream error", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.error", message: "Rate limited" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-3",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("error");
    expect(types).toContain("turn_aborted");
  });

  test("emits reasoning deltas when present", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.reasoning_summary_text.delta", delta: "Thinking..." },
      { type: "response.reasoning_summary_text.done", text: "Thinking..." },
      { type: "response.output_text.done", text: "Done" },
      { type: "response.completed", usage: { input_tokens: 10, output_tokens: 5 } },
      { type: "response.done" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-4",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("agent_reasoning_delta");
    expect(types).toContain("agent_reasoning");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/turn-runner.test.ts`
Expected: FAIL — `TurnRunner` not found.

- [ ] **Step 3: Write the TurnRunner**

`packages/core/src/turn-runner.ts`:
```typescript
import type { EventMsg, ToolCall, ToolContext } from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";
import type { ISandbox } from "@clawdex/shared-types";
import type { OpenAIStreamEvent, OpenAIMessage } from "./types.js";
import { dispatchToolCall } from "./tool-dispatch.js";

export interface TurnRunnerOptions {
  turnId: string;
  model: string;
  workingDir: string;
  toolRegistry: ToolRegistry;
  sandbox: ISandbox;
  /** Callback to emit events to the session/server layer. */
  emitEvent: (event: EventMsg) => Promise<void>;
  /** Factory to create the OpenAI stream. Called once per API request (may be called
   *  multiple times if tool calls create a loop). */
  createStream: () => AsyncGenerator<OpenAIStreamEvent>;
  /** Messages to prepend (conversation history). Set by the engine before each loop iteration. */
  messages?: OpenAIMessage[];
  /** Max tool-call loop iterations to prevent infinite loops. */
  maxToolRounds?: number;
}

interface PendingToolCall {
  callId: string;
  name: string;
  argumentChunks: string[];
}

export class TurnRunner {
  private readonly opts: TurnRunnerOptions;
  private readonly maxToolRounds: number;
  private interrupted = false;

  constructor(opts: TurnRunnerOptions) {
    this.opts = opts;
    this.maxToolRounds = opts.maxToolRounds ?? 10;
  }

  /** Signal the runner to abort the current turn. */
  interrupt(): void {
    this.interrupted = true;
  }

  /** Execute the turn: stream → collect → dispatch tools → loop or complete. */
  async run(): Promise<void> {
    await this.opts.emitEvent({
      type: "turn_started",
      turnId: this.opts.turnId,
      model: this.opts.model,
    } as EventMsg);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let round = 0; round < this.maxToolRounds; round++) {
      if (this.interrupted) {
        await this.opts.emitEvent({
          type: "turn_aborted",
          turnId: this.opts.turnId,
          reason: "user_interrupted",
        } as EventMsg);
        return;
      }

      const { textContent, reasoningContent, toolCalls, usage, error } =
        await this.processStream();

      if (error) {
        await this.opts.emitEvent({
          type: "error",
          message: error,
          fatal: false,
        } as EventMsg);
        await this.opts.emitEvent({
          type: "turn_aborted",
          turnId: this.opts.turnId,
          reason: "error",
        } as EventMsg);
        return;
      }

      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;

      // Emit final reasoning summary if present
      if (reasoningContent) {
        await this.opts.emitEvent({
          type: "agent_reasoning",
          summary: reasoningContent,
        } as EventMsg);
      }

      // If no tool calls, emit final message and complete
      if (toolCalls.length === 0) {
        if (textContent) {
          await this.opts.emitEvent({
            type: "agent_message",
            message: textContent,
          } as EventMsg);
        }

        await this.opts.emitEvent({
          type: "turn_complete",
          turnId: this.opts.turnId,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
          },
        } as EventMsg);
        return;
      }

      // Dispatch tool calls
      const ctx: ToolContext = {
        workingDir: this.opts.workingDir,
        sandbox: this.opts.sandbox,
      };

      for (const tc of toolCalls) {
        const call: ToolCall = {
          callId: tc.callId,
          tool: tc.name,
          args: JSON.parse(tc.arguments),
        };

        await this.opts.emitEvent({
          type: "tool_call_begin",
          callId: call.callId,
          tool: call.tool,
          args: call.args,
        } as EventMsg);

        const result = await dispatchToolCall(this.opts.toolRegistry, call, ctx);

        await this.opts.emitEvent({
          type: "tool_call_end",
          callId: call.callId,
          output: result.output,
          success: result.success,
        } as EventMsg);
      }

      // Tool results will be fed back in the next stream iteration
      // The engine is responsible for rebuilding the message list with tool results
    }

    // If we exhausted tool rounds, complete with what we have
    await this.opts.emitEvent({
      type: "turn_complete",
      turnId: this.opts.turnId,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    } as EventMsg);
  }

  /** Process a single stream from the API, collecting text, reasoning, and tool calls. */
  private async processStream(): Promise<{
    textContent: string;
    reasoningContent: string;
    toolCalls: Array<{ callId: string; name: string; arguments: string }>;
    usage: { inputTokens: number; outputTokens: number };
    error: string | null;
  }> {
    let textContent = "";
    let reasoningContent = "";
    const pendingToolCalls = new Map<string, PendingToolCall>();
    const completedToolCalls: Array<{ callId: string; name: string; arguments: string }> = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    const stream = this.opts.createStream();

    for await (const event of stream) {
      if (this.interrupted) break;

      switch (event.type) {
        case "response.output_text.delta":
          await this.opts.emitEvent({
            type: "agent_message_delta",
            delta: event.delta,
          } as EventMsg);
          textContent += event.delta;
          break;

        case "response.output_text.done":
          textContent = event.text;
          break;

        case "response.reasoning_summary_text.delta":
          await this.opts.emitEvent({
            type: "agent_reasoning_delta",
            delta: event.delta,
          } as EventMsg);
          reasoningContent += event.delta;
          break;

        case "response.reasoning_summary_text.done":
          reasoningContent = event.text;
          break;

        case "response.function_call_arguments.delta": {
          let pending = pendingToolCalls.get(event.call_id);
          if (!pending) {
            pending = { callId: event.call_id, name: "", argumentChunks: [] };
            pendingToolCalls.set(event.call_id, pending);
          }
          pending.argumentChunks.push(event.delta);
          break;
        }

        case "response.function_call_arguments.done":
          completedToolCalls.push({
            callId: event.call_id,
            name: event.name,
            arguments: event.arguments,
          });
          pendingToolCalls.delete(event.call_id);
          break;

        case "response.completed":
          usage = {
            inputTokens: event.usage.input_tokens,
            outputTokens: event.usage.output_tokens,
          };
          break;

        case "response.error":
          return {
            textContent,
            reasoningContent,
            toolCalls: completedToolCalls,
            usage,
            error: event.message,
          };

        case "response.done":
          break;
      }
    }

    return {
      textContent,
      reasoningContent,
      toolCalls: completedToolCalls,
      usage,
      error: null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/turn-runner.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/turn-runner.ts packages/core/tests/turn-runner.test.ts
git commit -m "feat(core): add TurnRunner with streaming turn loop + tool dispatch"
```

---

## Task 9: ClawdexEngine — Top-Level Orchestrator

**Files:**
- Create: `packages/core/src/engine.ts`
- Create: `packages/core/tests/engine.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/tests/engine.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ClawdexEngine } from "../src/engine.js";
import type { EventMsg } from "@clawdex/shared-types";
import { createTestConfig } from "@clawdex/testkit";
import { MockSandbox } from "@clawdex/testkit";
import { ToolRegistry } from "@clawdex/tools";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Minimal auth provider for testing
const mockAuthProvider = {
  getToken: async () => ({ token: "test-api-key", expiresAt: null }),
  getStatus: async () => ({ authenticated: true, method: "api_key" as const }),
  logout: async () => {},
};

describe("ClawdexEngine", () => {
  let sessionsDir: string;
  let engine: ClawdexEngine;

  beforeEach(async () => {
    sessionsDir = await mkdtemp(join(tmpdir(), "clawdex-engine-"));
    engine = new ClawdexEngine({
      config: createTestConfig(),
      authProvider: mockAuthProvider,
      sandbox: new MockSandbox(),
      toolRegistry: new ToolRegistry(),
      sessionsDir,
    });
  });

  afterEach(async () => {
    await rm(sessionsDir, { recursive: true, force: true });
  });

  test("createSession returns a new session with generated id", async () => {
    const session = await engine.createSession({ workingDir: "/tmp/project" });
    expect(session.id).toHaveLength(12);
    expect(session.workingDir).toBe("/tmp/project");
    expect(session.model).toBe("gpt-4o"); // from default config
  });

  test("createSession with custom name", async () => {
    const session = await engine.createSession({
      workingDir: "/tmp",
      name: "test session",
    });
    expect(session.name).toBe("test session");
  });

  test("getSession returns created session", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    const found = engine.getSession(session.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(session.id);
  });

  test("getSession returns null for unknown id", () => {
    expect(engine.getSession("nonexistent")).toBeNull();
  });

  test("listSessions returns all active sessions", async () => {
    await engine.createSession({ workingDir: "/a" });
    await engine.createSession({ workingDir: "/b" });
    const list = await engine.listSessions();
    expect(list).toHaveLength(2);
  });

  test("deleteSession removes session and persisted file", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    await engine.deleteSession(session.id);
    expect(engine.getSession(session.id)).toBeNull();
  });

  test("setSessionName updates name", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    await engine.setSessionName(session.id, "renamed");
    expect(engine.getSession(session.id)!.name).toBe("renamed");
  });

  test("loadSession restores a session from disk", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: new Date().toISOString(),
    });
    // Persist it
    await engine.saveSession(session.id);

    // Create a new engine pointing to same dir
    const engine2 = new ClawdexEngine({
      config: createTestConfig(),
      authProvider: mockAuthProvider,
      sandbox: new MockSandbox(),
      toolRegistry: new ToolRegistry(),
      sessionsDir,
    });
    const loaded = await engine2.loadSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(1);
  });

  test("on/off event listener management", async () => {
    const events: EventMsg[] = [];
    const handler = (e: EventMsg) => { events.push(e); };

    engine.on("event", handler);
    await engine.emit({
      type: "turn_started",
      turnId: "t1",
      model: "gpt-4o",
    } as EventMsg);
    expect(events).toHaveLength(1);

    engine.off("event", handler);
    await engine.emit({
      type: "turn_started",
      turnId: "t2",
      model: "gpt-4o",
    } as EventMsg);
    expect(events).toHaveLength(1); // not incremented
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test tests/engine.test.ts`
Expected: FAIL — `ClawdexEngine` not found.

- [ ] **Step 3: Write the ClawdexEngine**

`packages/core/src/engine.ts`:
```typescript
import type {
  ClawdexConfig,
  IAuthProvider,
  ISandbox,
  EventMsg,
  SessionSummary,
} from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";
import type { EngineOptions, TurnOptions, OpenAIStreamEvent } from "./types.js";
import { Session } from "./session.js";
import { SessionStore } from "./session-store.js";
import { TurnRunner } from "./turn-runner.js";
import { createOpenAIStream } from "./openai-stream.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { shouldAutoCompact, buildCompactPrompt, compactMessages } from "./context-manager.js";
import { join } from "node:path";
import { homedir } from "node:os";

type EventHandler = (event: EventMsg) => void;

export class ClawdexEngine {
  readonly config: ClawdexConfig;
  private readonly authProvider: IAuthProvider;
  private readonly sandbox: ISandbox;
  private readonly toolRegistry: ToolRegistry;
  private readonly store: SessionStore;
  private readonly sessions = new Map<string, Session>();
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private activeTurnRunner: TurnRunner | null = null;

  constructor(opts: EngineOptions) {
    this.config = opts.config;
    this.authProvider = opts.authProvider;
    this.sandbox = opts.sandbox;
    this.toolRegistry = opts.toolRegistry;
    const sessionsDir =
      opts.sessionsDir ?? join(homedir(), ".clawdex", "sessions");
    this.store = new SessionStore(sessionsDir);
  }

  // ── Event Emitter ─────────────────────────────────────

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  async emit(msg: EventMsg): Promise<void> {
    const handlers = this.listeners.get("event");
    if (handlers) {
      for (const handler of handlers) {
        handler(msg);
      }
    }
  }

  // ── Session CRUD ──────────────────────────────────────

  async createSession(opts: {
    workingDir: string;
    name?: string;
  }): Promise<Session> {
    const session = new Session({
      workingDir: opts.workingDir,
      model: this.config.model,
      sandboxPolicy: this.config.sandbox_mode,
      name: opts.name,
    });
    this.sessions.set(session.id, session);
    await this.store.save(session);
    return session;
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  async loadSession(id: string): Promise<Session | null> {
    // Check in-memory first
    const existing = this.sessions.get(id);
    if (existing) return existing;

    // Load from disk
    const loaded = await this.store.load(id);
    if (loaded) {
      this.sessions.set(loaded.id, loaded);
    }
    return loaded;
  }

  async listSessions(): Promise<SessionSummary[]> {
    // Include both in-memory and on-disk sessions
    const diskSummaries = await this.store.list();
    const memoryIds = new Set(this.sessions.keys());

    // Merge: prefer in-memory (more up-to-date) over disk
    const result: SessionSummary[] = [];
    for (const s of this.sessions.values()) {
      result.push(s.toSummary());
    }
    for (const ds of diskSummaries) {
      if (!memoryIds.has(ds.id)) {
        result.push(ds);
      }
    }

    return result.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    await this.store.delete(id);
  }

  async setSessionName(id: string, name: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.setName(name);
      await this.store.save(session);
    }
  }

  async saveSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await this.store.save(session);
    }
  }

  // ── Turn Execution ────────────────────────────────────

  async runTurn(sessionId: string, opts: TurnOptions): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      await this.emit({
        type: "error",
        message: `Session not found: ${sessionId}`,
        code: "SESSION_NOT_FOUND",
        fatal: false,
      } as EventMsg);
      return;
    }

    // Get auth token
    const auth = await this.authProvider.getToken();
    if (!auth.token) {
      await this.emit({
        type: "error",
        message: "Authentication required",
        code: "AUTH_REQUIRED",
        fatal: false,
      } as EventMsg);
      return;
    }

    const model = opts.model ?? session.model;
    const turnId = `turn-${Date.now()}`;

    // Add user message to session
    session.addMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: opts.prompt,
      timestamp: new Date().toISOString(),
      turnId,
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      config: this.config,
      model,
      workingDir: session.workingDir,
      sandboxPolicy: session.sandboxPolicy,
    });

    // Build message list for API
    const toolSchemas = this.toolRegistry.listSchemas();

    const runner = new TurnRunner({
      turnId,
      model,
      workingDir: session.workingDir,
      toolRegistry: this.toolRegistry,
      sandbox: this.sandbox,
      emitEvent: async (e) => {
        await this.emit(e);
        // Record assistant messages to session
        if (e.type === "agent_message") {
          session.addMessage({
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: (e as any).message,
            timestamp: new Date().toISOString(),
            turnId,
          });
        }
        // Accumulate token usage
        if (e.type === "turn_complete") {
          session.addTokenUsage((e as any).usage);
        }
      },
      createStream: () =>
        createOpenAIStream({
          baseUrl: this.config.auth.base_url,
          apiKey: auth.token,
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...session.messages.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
          ],
          tools: toolSchemas,
          reasoningEffort: opts.effort,
        }),
    });

    this.activeTurnRunner = runner;
    try {
      await runner.run();
    } finally {
      this.activeTurnRunner = null;
      // Auto-save after turn completes
      await this.store.save(session);
    }
  }

  // ── Turn Control ──────────────────────────────────────

  interrupt(): void {
    this.activeTurnRunner?.interrupt();
  }

  async undo(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.emit({ type: "undo_started" } as EventMsg);
    const removed = session.popLastTurnMessages();
    const revertedFiles = removed
      .flatMap((m) => m.toolCalls ?? [])
      .filter((tc) => tc.tool === "file-write" || tc.tool === "apply-patch")
      .map((tc) => tc.args.path as string)
      .filter(Boolean);

    await this.emit({
      type: "undo_completed",
      turnId: removed[0]?.turnId ?? "",
      revertedFiles,
    } as EventMsg);

    await this.store.save(session);
  }

  async compact(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const prompt = buildCompactPrompt(session.messages);

    // Get auth for the compact API call
    const auth = await this.authProvider.getToken();
    if (!auth.token) return;

    // Use the LLM to generate a summary
    let summary = "";
    const stream = createOpenAIStream({
      baseUrl: this.config.auth.base_url,
      apiKey: auth.token,
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      tools: [],
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        summary += event.delta;
      }
    }

    if (summary) {
      const previousTokens = session.tokenUsage.totalTokens;
      const lastUserMsg = [...session.messages]
        .reverse()
        .find((m) => m.role === "user");
      session.replaceMessages(compactMessages(summary, lastUserMsg));
      const newTokens = session.tokenUsage.totalTokens;

      await this.emit({
        type: "context_compacted",
        previousTokens,
        newTokens,
      } as EventMsg);

      await this.store.save(session);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test tests/engine.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine.ts packages/core/tests/engine.test.ts
git commit -m "feat(core): add ClawdexEngine orchestrator with session CRUD and turn execution"
```

---

## Task 10: Update Index Exports + Final Verification

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update index.ts with all public exports**

`packages/core/src/index.ts`:
```typescript
// Core engine
export { ClawdexEngine } from "./engine.js";

// Session
export { Session } from "./session.js";
export type { SessionCreateOptions } from "./session.js";

// Session store
export { SessionStore } from "./session-store.js";

// Turn execution
export { TurnRunner } from "./turn-runner.js";
export type { TurnRunnerOptions } from "./turn-runner.js";

// OpenAI streaming
export { createOpenAIStream, parseSSELine } from "./openai-stream.js";
export type { OpenAIStreamConfig } from "./openai-stream.js";

// Tool dispatch
export { dispatchToolCall } from "./tool-dispatch.js";

// Context management
export {
  estimateTokens,
  shouldAutoCompact,
  buildCompactPrompt,
  compactMessages,
} from "./context-manager.js";

// System prompt
export { buildSystemPrompt } from "./system-prompt.js";
export type { SystemPromptOptions } from "./system-prompt.js";

// Types
export type {
  EngineOptions,
  TurnOptions,
  TurnState,
  SessionFile,
  OpenAIMessage,
  OpenAIStreamEvent,
} from "./types.js";
```

- [ ] **Step 2: Run all core tests**

Run: `cd packages/core && bun test`
Expected: All tests PASS.

- [ ] **Step 3: Run typecheck**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): finalize public exports"
```

- [ ] **Step 5: Run full monorepo build and test**

Run:
```bash
pnpm -r run typecheck
pnpm -r run test
```
Expected: All packages pass typecheck and tests.
