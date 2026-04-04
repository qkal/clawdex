# Clawdex MVP Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Author:** Brainstorming session

---

## 1. Overview

Clawdex is a TypeScript/Bun rewrite of the OpenAI Codex CLI, forked as an independent project. It replaces the Rust codebase with a TypeScript-native monorepo and replaces the terminal TUI with a web-based GUI served from a local server.

### Goals

- Full functional parity with Codex CLI core capabilities
- Web UI instead of TUI — local server + browser launch
- TypeScript-native architecture (not a literal Rust translation)
- pnpm workspaces monorepo with Bun runtime and Bun test
- Windows + Linux support (macOS deferred)
- Incremental, reviewable, reversible migration

### Non-Goals (MVP)

- Analytics/telemetry
- Cloud tasks
- Rollout/feature flags
- Responses API proxy
- MCP server mode (clawdex as an MCP server)
- macOS support
- Terminal TUI
- Collaboration mode templates
- Realtime/audio features

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Language | TypeScript (strict) |
| Package manager | pnpm (workspaces) |
| Test runner | Bun test |
| Build | tsup (packages), SvelteKit (web) |
| Frontend | SvelteKit + Svelte 5 |
| UI components | shadcn-svelte + Tailwind CSS v4 |
| Diff viewer | Monaco Editor (lazy-loaded) |
| Markdown | marked (streaming) |
| Syntax highlighting | shiki |
| Headless primitives | bits-ui (via shadcn-svelte) |
| TOML parsing | smol-toml |
| Validation | Zod |
| MCP client | @modelcontextprotocol/sdk |
| LLM API | OpenAI (native fetch, streaming) |

---

## 3. Package Architecture

### Monorepo Layout

```
clawdex/
├── pnpm-workspace.yaml
├── package.json                ← root: shared scripts, devDeps
├── bunfig.toml                 ← Bun runtime config
├── tsconfig.build.json         ← project references to all packages
├── eslint.config.js            ← shared flat config
├── .prettierrc.toml
├── .node-version               ← "22"
├── scripts/
│   ├── check-circular-deps.js
│   └── verify-exports.js
├── .github/
│   ├── actions/setup/action.yml  ← composite setup action
│   └── workflows/
│       ├── ci-pr.yml
│       ├── ci-main.yml
│       └── ci-nightly.yml
└── packages/
    ├── shared-types/
    ├── config/
    ├── auth/
    ├── tools/
    ├── sandbox/
    ├── memories/
    ├── mcp-client/
    ├── skills/
    ├── core/
    ├── server/
    ├── cli/
    ├── web/
    └── testkit/
```

### Package Responsibilities

**shared-types** (zero dependencies)
All cross-package contracts: TypeScript types, interfaces, error classes, WebSocket protocol messages, `ITool` interface, `ISandbox` interface, `IAuthProvider` interface, config schema types, session types, skill/plugin types.

**config** (depends on: shared-types)
TOML parsing with smol-toml, Zod schema validation, config file discovery (`~/.clawdex/config.toml` + project-local), defaults, merge logic, environment variable mapping. Generates JSON schema from Zod for editor autocomplete.

**auth** (depends on: shared-types)
ChatGPT OAuth flow (browser redirect, token storage, refresh), API key fallback. Receives auth settings as constructor args — no config parsing internally. Exposes `IAuthProvider` that core uses to get tokens.

**tools** (depends on: shared-types)
Implements `ITool` interface for each built-in tool:
- `file-read` — read file contents
- `file-write` — write file contents (checks `ISandbox`)
- `shell` — spawn child process within sandbox constraints
- `apply-patch` — Codex patch format parser and applier

Tools are pure: they receive inputs + context (working dir, `ISandbox`) as args.

**sandbox** (depends on: shared-types)
Implements `ISandbox` interface:
- `NoopSandbox` — for development, allows everything
- `WindowsSandbox` — Job Objects + filesystem ACLs
- `LinuxSandbox` — Landlock

Core creates the appropriate sandbox based on platform + config and injects it into tools.

**memories** (depends on: shared-types)
File-based cross-session memory persistence. Simplified from Codex's two-phase DB-backed system to single-pass file-based for MVP:
- Read/write memory files to `~/.clawdex/memories/`
- Single consolidation pass (no sub-agent, no state DB)
- Receives storage path as config.

**mcp-client** (depends on: shared-types, @modelcontextprotocol/sdk)
Connects to configured MCP servers, discovers their tools, exposes them as `ITool` instances that core can dispatch. Handles MCP elicitation requests.

**skills** (depends on: shared-types)
Skill/plugin discovery from filesystem (project-local + global `~/.clawdex/skills/`), manifest parsing, registry, invocation logic, plugin loading.

**core** (depends on: all above)
The engine. Creates sessions, manages conversation turns, calls OpenAI streaming API, dispatches tool calls to tools/mcp-client/skills, manages sandbox lifecycle, persists sessions to disk, emits events for all state changes via EventEmitter. This is the only package that wires everything together.

**server** (depends on: core, shared-types)
Thin HTTP + WebSocket server using `Bun.serve()`:
- REST endpoints for session CRUD, config, health
- WebSocket for real-time streaming of core events
- Serves built SvelteKit web assets as static files
- No business logic — pure adapter between HTTP/WS and core.

**cli** (depends on: server, core, config, auth)
User-facing entrypoint binary:
- `clawdex` (no args) → start server + open browser (interactive mode)
- `clawdex exec "prompt"` → run core directly, stream to stdout (headless mode)
- Subcommands: `config`, `auth`, `mcp`, `sessions`
- Handles graceful shutdown, server lock file management.

**web** (depends on: shared-types as devDep)
SvelteKit app with shadcn-svelte + Tailwind CSS v4. Built to static assets with `@sveltejs/adapter-static`. Communicates with server exclusively via WebSocket + REST. No runtime dependency on backend packages.

**testkit** (depends on: shared-types)
Shared test utilities: mock LLM client, mock filesystem, mock sandbox, test fixtures, helpers for setting up test sessions. Used as devDep by all packages.

### Dependency Graph

```
shared-types    (zero deps — the foundation)
     ↑
     ├── config
     ├── auth
     ├── tools
     ├── sandbox
     ├── memories
     ├── mcp-client  (+ @modelcontextprotocol/sdk)
     ├── skills
     ├── testkit
     └── web         (devDep only, for WS protocol types)

core → tools, mcp-client, sandbox, memories, skills, config, auth, shared-types
server → core, shared-types
cli → server, core, config, auth
```

### Design Rules

1. No circular dependencies — strictly enforced by package boundaries.
2. `shared-types` defines all contracts — ITool, ISandbox, IAuthProvider, WS protocol, config schema types, error types.
3. Dependency injection everywhere — tools receive ISandbox, core receives IAuthProvider, etc.
4. `core` is the only "fat" node — it's the orchestrator, so many deps are expected.
5. `web` communicates only via network — imports shared-types for type safety but zero runtime dependency on backend.
6. `server` is stateless glue — translates HTTP/WS to core calls, no business logic.

---

## 4. WebSocket Protocol

Based on the Rust Codex Submission Queue / Event Queue pattern. The client sends `Submission` messages, the server emits `Event` messages.

### Submissions (Client → Server)

```typescript
type Submission = {
  id: string;                    // unique, client-generated
  op: Op;
};

type Op =
  // Turn lifecycle
  | { type: "user_turn"; prompt: string; sessionId: string;
      model?: string; effort?: "low" | "medium" | "high" }
  | { type: "interrupt" }
  | { type: "undo" }
  | { type: "compact" }
  | { type: "shutdown" }

  // Approvals
  | { type: "exec_approval"; callId: string;
      decision: "approve" | "deny"; reason?: string }
  | { type: "patch_approval"; callId: string;
      decision: "approve" | "deny" }
  | { type: "mcp_elicitation_response"; requestId: string;
      serverName: string; decision: "approve" | "deny"; content?: unknown }

  // Session management
  | { type: "create_session"; workingDir?: string; name?: string }
  | { type: "load_session"; sessionId: string }
  | { type: "delete_session"; sessionId: string }
  | { type: "set_session_name"; sessionId: string; name: string }
  | { type: "list_sessions" }

  // Direct shell
  | { type: "run_user_shell_command"; command: string }

  // Models
  | { type: "list_models" }

  // MCP
  | { type: "list_mcp_tools" }
  | { type: "refresh_mcp_servers" }

  // Skills
  | { type: "list_skills"; workingDirs?: string[] }

  // Memories
  | { type: "update_memories" }
  | { type: "drop_memories" }

  // Config
  | { type: "reload_config" }

  // Auth
  | { type: "start_oauth" }
  | { type: "logout" }
```

### Events (Server → Client)

```typescript
type Event = {
  submissionId?: string;
  msg: EventMsg;
};

type EventMsg =
  // Connection handshake (sent on connect/reconnect)
  | { type: "connection_ready"; serverVersion: string;
      authStatus: AuthStatus; activeSession?: SessionSnapshot;
      activeTurn?: ActiveTurnState }

  // Turn lifecycle
  | { type: "turn_started"; turnId: string; model: string }
  | { type: "turn_complete"; turnId: string; usage: TokenUsage }
  | { type: "turn_aborted"; turnId: string;
      reason: "user_interrupted" | "error" | "shutdown" }
  | { type: "token_count"; session: TokenUsage; lastTurn?: TokenUsage }

  // Agent output (streaming)
  | { type: "agent_message_delta"; delta: string }
  | { type: "agent_message"; message: string }
  | { type: "agent_reasoning_delta"; delta: string }
  | { type: "agent_reasoning"; summary: string }

  // Tool calls (generic)
  | { type: "tool_call_begin"; callId: string;
      tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; callId: string;
      output: string; success: boolean }

  // Shell execution lifecycle
  | { type: "exec_command_begin"; callId: string;
      command: string; cwd: string }
  | { type: "exec_command_output_delta"; callId: string;
      chunk: string; stream: "stdout" | "stderr" }
  | { type: "exec_command_end"; callId: string; exitCode: number }

  // Patch lifecycle
  | { type: "patch_apply_begin"; callId: string;
      path: string; patch: string }
  | { type: "patch_apply_end"; callId: string;
      path: string; success: boolean; error?: string }

  // File diffs (powers visual diff viewer)
  | { type: "turn_diff"; diffs: FileDiff[] }

  // Approval requests
  | { type: "exec_approval_request"; callId: string;
      command: string; cwd: string; risk: RiskLevel }
  | { type: "patch_approval_request"; callId: string;
      path: string; patch: string }
  | { type: "mcp_elicitation_request"; requestId: string;
      serverName: string; message: string; schema?: unknown }

  // MCP
  | { type: "mcp_startup_update"; server: string;
      status: "connecting" | "connected" | "failed"; error?: string }
  | { type: "mcp_startup_complete"; servers: McpServerStatus[] }
  | { type: "mcp_tool_call_begin"; callId: string;
      server: string; tool: string; args: Record<string, unknown> }
  | { type: "mcp_tool_call_end"; callId: string;
      result: unknown; success: boolean }
  | { type: "mcp_list_tools_response"; tools: McpToolInfo[] }

  // Skills
  | { type: "list_skills_response"; skills: SkillInfo[] }

  // Models
  | { type: "list_models_response"; models: ModelInfo[] }

  // Session management
  | { type: "session_created"; sessionId: string; name?: string }
  | { type: "session_loaded"; session: SessionSnapshot }
  | { type: "session_list"; sessions: SessionSummary[] }
  | { type: "session_name_updated"; sessionId: string; name: string }
  | { type: "session_deleted"; sessionId: string }

  // Context management
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
  | { type: "shutdown_complete" }
```

### Supporting Types

```typescript
type FileDiff = {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
  isBinary: boolean;
  truncated: boolean;
};

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
};

type AuthStatus = {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  user?: string;
};

type ModelInfo = {
  id: string;
  name: string;
  supportsReasoning: boolean;
  contextWindow: number;
};

type ActiveTurnState = {
  turnId: string;
  model: string;
  pendingApproval?: {
    type: "exec" | "patch" | "mcp_elicitation";
    callId: string;
  };
};

type RiskLevel = "low" | "medium" | "high";

type ErrorCode =
  | "TURN_IN_PROGRESS"
  | "SESSION_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "INVALID_MODEL"
  | "INVALID_SUBMISSION"
  | "INTERNAL_ERROR";

type McpServerStatus = {
  name: string;
  status: "connected" | "failed";
  toolCount: number;
  error?: string;
};

type McpToolInfo = {
  server: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

type SkillInfo = {
  id: string;
  name: string;
  description: string;
  scope: "global" | "project";
};

type SessionSummary = {
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  workingDir: string;
};

type SessionSnapshot = {
  summary: SessionSummary;
  messages: ChatMessage[];
  workingDir: string;
  model: string;
  sandboxPolicy: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  toolCalls?: ToolCallRecord[];
};

type ToolCallRecord = {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
  success: boolean;
  durationMs: number;
};
```

### Security: Local Auth Token

```
1. CLI generates crypto-random 32-byte token (base64url)
2. Server binds to 127.0.0.1 only (localhost)
3. Token required on WS upgrade (?token=) and REST (Authorization: Bearer)
4. Browser URL: http://127.0.0.1:{port}/?token={token}
5. Web stores token in sessionStorage (scoped to tab)
6. Rejected connections get HTTP 401, no details
```

### Reconnection Protocol

```
1. WebSocket drops
2. Client retries with exponential backoff: 100ms, 200ms, 400ms, ... max 5s
3. On reconnect, sends same token
4. Server sends connection_ready with current state
5. If turn completed during disconnect, server replays turn_complete + turn_diff
```

### Concurrency Rules

- One active turn per session. `user_turn` during active turn returns `TURN_IN_PROGRESS` error.
- `interrupt` cancels active turn. Safe to send when no turn is active (no-op).
- `undo` during active turn returns `TURN_IN_PROGRESS` error. Must interrupt first.
- `run_user_shell_command` is allowed during active turn (separate from agent turn).
- Multiple WS connections: last writer wins (MVP simplicity).

---

## 5. Web UI Design

### Tech Stack

```
SvelteKit + Svelte 5
├── shadcn-svelte          (UI components)
├── Tailwind CSS v4        (utility styling)
├── bits-ui                (headless primitives, shadcn dependency)
├── Monaco Editor          (diff viewer, lazy-loaded)
├── marked                 (streaming markdown)
└── shiki                  (syntax highlighting)
```

### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header Bar                                    [model ▾] [⚙]│
├────────────┬────────────────────────────────────────────────┤
│  Sidebar   │  Main Chat Area                                │
│  Sessions  │  ┌────────────────────────────────────────┐    │
│  ────────  │  │ Messages (scrollable)                  │    │
│  > Current │  │  - User messages                       │    │
│    Prev    │  │  - Agent messages (streaming markdown)  │    │
│    Older   │  │  - Shell output (terminal-styled)       │    │
│            │  │  - Diff viewer (Monaco)                 │    │
│  [+ New]   │  │  - Tool call cards                     │    │
│            │  │  - Approval cards                       │    │
│            │  └────────────────────────────────────────┘    │
│            │  ┌────────────────────────────────────────┐    │
│            │  │ Input composer          [Send] / [Stop] │    │
│            │  └────────────────────────────────────────┘    │
├────────────┴────────────────────────────────────────────────┤
│  Status: tokens 1,234/128k  │  sandbox: workspace-write     │
└─────────────────────────────────────────────────────────────┘
```

### Component Tree

```
App.svelte
├── Header.svelte
│   ├── ModelSelector.svelte        (shadcn Select)
│   └── SettingsButton.svelte
├── Sidebar.svelte
│   ├── SessionList.svelte          (shadcn ScrollArea, ContextMenu)
│   │   └── SessionItem.svelte
│   └── NewSessionButton.svelte     (shadcn Button)
├── ChatArea.svelte
│   ├── MessageList.svelte
│   │   └── MessageBubble.svelte
│   │       ├── UserMessage.svelte
│   │       ├── AgentMessage.svelte      (markdown + syntax highlighting)
│   │       ├── ReasoningBlock.svelte    (shadcn Collapsible)
│   │       ├── ShellOutput.svelte       (terminal-styled, stdout/stderr)
│   │       ├── DiffViewer.svelte        (Monaco diff editor)
│   │       ├── ToolCallCard.svelte      (shadcn Card, Collapsible)
│   │       ├── McpToolCard.svelte       (shadcn Card, Badge)
│   │       └── ApprovalCard.svelte      (shadcn Alert, Button, Badge)
│   ├── InputComposer.svelte
│   │   ├── Textarea (auto-resize)
│   │   ├── SendButton.svelte
│   │   └── InterruptButton.svelte
│   └── UndoButton.svelte
├── StatusBar.svelte
│   ├── TokenCounter.svelte         (shadcn Badge, Tooltip)
│   ├── SandboxBadge.svelte         (shadcn Badge)
│   └── ConnectionStatus.svelte
├── SettingsPanel.svelte            (shadcn Sheet, Input, Switch, Tabs)
└── AuthGate.svelte                 (shadcn Dialog)
```

### Key UI Behaviors

- **Streaming:** `agent_message_delta` events append in real-time. Markdown rendered incrementally.
- **Shell output:** Monospace, dark background. stdout white, stderr red.
- **Diff viewer:** Monaco inline diff by default, expandable to side-by-side. Lazy-loaded.
- **Approvals:** Inline cards with risk-level color badge. Disabled after decision.
- **Auto-scroll:** Scrolls to bottom on new content unless user scrolled up. "Scroll to bottom" button appears.
- **Keyboard shortcuts:** Enter=send, Shift+Enter=newline, Ctrl+C during turn=interrupt, Ctrl+Z after turn=undo.

---

## 6. Migration Phases

### MVP-Alpha (First usable build)

**Phase 1: Foundation** (parallel, no interdependencies)

| Package | Scope |
|---|---|
| shared-types | All interfaces, types, error classes, WS protocol messages |
| config | TOML parser, schema validation, file discovery, defaults |
| auth | API key auth from config; ChatGPT OAuth stubbed |
| testkit | Mock LLM client, mock filesystem, fixture helpers |

**Phase 2: Tools & Sandbox** (depends on Phase 1)

| Package | Scope |
|---|---|
| tools | file-read, file-write, shell execution, apply-patch |
| sandbox | ISandbox noop first, Windows second, Linux third |

**Phase 3: Core Engine** (depends on Phase 1 + 2)

| Package | Scope |
|---|---|
| core | Session lifecycle, turn orchestration, OpenAI streaming, tool dispatch, session persistence |

**Phase 4: Server + Web** (depends on Phase 3)

| Package | Scope |
|---|---|
| server | Bun.serve HTTP + WebSocket, REST for sessions, WS streaming |
| web | SvelteKit: chat, streaming messages, tool output, session history, diff viewer |

**Phase 5: CLI + Integration**

| Package | Scope |
|---|---|
| cli | `clawdex` (interactive), `clawdex exec` (headless), subcommands |
| — | End-to-end testing, first-run experience, visual diff viewer polish |

**MVP-Alpha checkpoint:** `clawdex` opens browser, chat with OpenAI, tool execution (files, shell, patches), visual diffs, session persistence, API key auth.

### MVP-Complete (Full feature set)

**Phase 6: Auth + Memories**

| Package | Scope |
|---|---|
| auth | Full ChatGPT OAuth (browser redirect, token refresh) |
| memories | File-based cross-session memory, single-pass consolidation |

**Phase 7: MCP + Skills**

| Package | Scope |
|---|---|
| mcp-client | Connect to MCP servers, discover tools, expose as ITool |
| skills | Filesystem discovery, manifest parsing, plugin loading, registry |

**Phase 8: Sandbox Hardening**

| Package | Scope |
|---|---|
| sandbox | Windows backend (Job Objects + ACLs), Linux backend (Landlock) |

**Phase 9: Polish**

- Error handling edge cases
- Graceful shutdown
- Config hot-reload in web UI
- Session search/filtering
- CI pipelines finalized

---

## 7. CI Strategy

### Workflows

**PR CI (`.github/workflows/ci-pr.yml`)**
- Trigger: pull_request to main
- Concurrency: cancel stale runs per PR
- Jobs (parallel): typecheck, lint, test-unit, test-integration, build-packages, build-web
- Uses `pnpm --filter '...[origin/main]'` for targeted testing
- Target: < 3 minutes

**Main CI (`.github/workflows/ci-main.yml`)**
- Trigger: push to main
- Concurrency: no cancellation (every commit verified)
- Jobs (parallel): typecheck, lint, test-all (unit + integration), build-all, verify-deps
- Runs full test suite, not filtered

**Nightly CI (`.github/workflows/ci-nightly.yml`)**
- Trigger: cron 4am UTC + manual
- Matrix: ubuntu-latest + windows-latest
- Jobs: full tests, coverage, sandbox platform tests, security audit

### Shared Setup (composite action)

```yaml
# .github/actions/setup/action.yml
steps:
  - oven-sh/setup-bun@v2 (bun 1.x)
  - pnpm/action-setup@v4 (pnpm 10)
  - actions/setup-node@v4 (from .node-version, cache pnpm)
  - pnpm install --frozen-lockfile
```

### Test Conventions

- `*.test.ts` — unit tests (fast, mocked, no I/O)
- `*.integration.test.ts` — integration tests (real files, shell, config)
- Unit tests use testkit mocks for LLM, filesystem, sandbox
- Integration tests needing OpenAI API skip when `OPENAI_API_KEY` is unset

### Branch Protection

- Require PR before merge to main
- Required checks: typecheck, lint, test-unit, test-integration, build-packages, build-web
- Require up-to-date branch
- No force pushes, no deletions

---

## 8. Config System

### Config File Locations

```
~/.clawdex/
├── config.toml              ← global user config
├── auth.json                ← OAuth tokens (restrictive permissions)
├── memories/
├── sessions/
├── skills/
├── plugins/
└── server.lock              ← PID + port of running server

<project-root>/.clawdex/
├── config.toml              ← project-local overrides (committable)
└── skills/                  ← project-local skills
```

### Config Merge Order (highest priority wins)

1. CLI flags (`--model`, `--sandbox`, etc.)
2. Environment variables (`CLAWDEX_MODEL`, `OPENAI_API_KEY`)
3. Project config (`<project>/.clawdex/config.toml`)
4. Global config (`~/.clawdex/config.toml`)
5. Built-in defaults

Merge rules: deep merge objects, replace arrays, resolve `env:` prefixes at load time.

### Key Config Fields

```toml
model = "gpt-4o"
model_reasoning_effort = "medium"
model_context_window = 128000
model_auto_compact_token_limit = 0.8
developer_instructions = ""
approval_policy = "on-request"      # "on-request" | "always" | "never"
sandbox_mode = "workspace-write"    # "read-only" | "workspace-write" | "danger-full-access"

[auth]
api_key_env = "OPENAI_API_KEY"
base_url = "https://api.openai.com/v1"

[server]
host = "127.0.0.1"
port = 3141
open_browser = true

[sandbox]
writable_roots = []
network_access = false

[mcp_servers.<name>]
command = "..."
args = [...]
env = {}
enabled = true

[memories]
enabled = true

[skills]
enabled = true

[plugins]
enabled = true

[history]
max_sessions = 100
max_session_age_days = 90

[notify]
command = ""

project_root_markers = [".git", ".clawdex", "package.json", "Cargo.toml", "go.mod", "pyproject.toml"]
```

### Environment Variables

```
OPENAI_API_KEY              → auth API key (direct)
CLAWDEX_MODEL               → model
CLAWDEX_SANDBOX_MODE        → sandbox_mode
CLAWDEX_HOST                → server.host
CLAWDEX_PORT                → server.port
CLAWDEX_APPROVAL_POLICY     → approval_policy
CLAWDEX_BASE_URL            → auth.base_url
CLAWDEX_CA_CERTIFICATE      → custom CA cert PEM path
SSL_CERT_FILE               → fallback CA cert path
```

### Project Root Discovery

Walk up from cwd looking for markers defined in `project_root_markers`. First match wins. If no marker found, cwd is used as project root.

### First-Run Experience

1. Create `~/.clawdex/` directory structure
2. Write default `config.toml` with comments
3. Start server, open browser
4. Web UI shows AuthGate: paste API key or OAuth login
5. After auth, land in fresh session

### Server Lock File

```jsonc
// ~/.clawdex/server.lock
{
  "pid": 12345,
  "host": "127.0.0.1",
  "port": 3141,
  "token": "...",
  "cwd": "/path/to/project",
  "startedAt": "2026-04-04T10:00:00Z"
}
```

On startup: check lock → if PID alive and same cwd, reuse existing server → if PID dead, delete stale lock → start fresh.

---

## 9. CLI Interface

```
clawdex                              # interactive mode
clawdex exec "prompt"                # headless mode
clawdex exec --ephemeral "prompt"    # no session persistence
clawdex exec -i                      # read prompt from stdin
clawdex exec --json                  # structured NDJSON output
clawdex exec --quiet                 # final message only

clawdex config                       # print resolved config
clawdex config show                  # alias
clawdex config edit                  # open in $EDITOR
clawdex config edit --local          # project config in $EDITOR
clawdex config set <key> <value>     # set global
clawdex config set --local <k> <v>   # set project
clawdex config path                  # print paths

clawdex auth login                   # ChatGPT OAuth
clawdex auth logout
clawdex auth status

clawdex mcp list
clawdex mcp add <name> <command>

clawdex sessions list
clawdex sessions delete <id>
clawdex sessions prune

clawdex --model <model>
clawdex --sandbox <mode>
clawdex --port <port>
clawdex --no-open
clawdex --approval-policy <policy>
clawdex --cwd <path>
clawdex --version
clawdex --help
```

### Exec Mode Defaults

- `approval_policy` defaults to `"never"` (no one to approve)
- Override with `--approval-policy on-request` if needed

### Exit Codes

```
0 — success (agent completed turn)
1 — error (API, config, auth)
2 — interrupted (Ctrl+C / SIGINT)
3 — tool failure (unrecoverable)
```

---

## 10. Session Persistence

### Format

```jsonc
// ~/.clawdex/sessions/{id}.json
{
  "version": 1,
  "id": "nanoid-12-chars",
  "name": "optional name",
  "createdAt": "ISO8601",
  "lastActiveAt": "ISO8601",
  "workingDir": "/path",
  "model": "gpt-4o",
  "sandboxPolicy": "workspace-write",
  "messages": [...],
  "tokenUsage": {...},
  "diffs": [...]
}
```

- Session IDs: nanoid, 12 alphanumeric characters
- Tool outputs > 10KB stored as separate files (`sessions/{id}/output-{callId}.txt`), referenced as `ref:filename` in session JSON
- Cleanup: on session create, prune sessions beyond `history.max_sessions` and `history.max_session_age_days`

---

## 11. Platform Support

| Platform | Priority | Sandbox Backend |
|---|---|---|
| Windows 11 | Primary (dev environment) | Job Objects + ACLs |
| Linux (Ubuntu) | Primary (CI + servers) | Landlock |
| macOS | Deferred post-MVP | Seatbelt (future) |

Sandbox abstraction (`ISandbox` interface) is designed from Phase 1. Platform backends are implemented incrementally in Phase 8. `NoopSandbox` is used during development.

---

## 12. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Bun Windows edge cases | Medium | Nightly CI on Windows; fallback to Node for specific operations if needed |
| Sandbox native bindings | High | Design ISandbox interface early; NoopSandbox for development; implement backends last |
| OpenAI API streaming compatibility | Medium | Use native fetch with ReadableStream; test against real API in integration tests |
| Monaco Editor bundle size | Low | Lazy-load only on first diff event; web workers for syntax |
| MCP SDK compatibility with Bun | Medium | MCP SDK targets Node; test early in Phase 7; may need polyfills |
| Session file corruption | Low | Atomic writes (write temp file, rename); version field for migration |
| Skills/plugins system complexity | Medium | Defer to Phase 7; design skill manifest format early in shared-types |
