# Phase 4: Server + Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `server` package (Bun HTTP + WebSocket server that bridges core events to the network) and the `web` package (SvelteKit + shadcn-svelte chat UI with streaming messages, tool output cards, diffs, and session management).

**Architecture:** `server` is a thin adapter — `Bun.serve()` with REST endpoints for health/sessions and a WebSocket that relays `Submission` ops to `ClawdexEngine` and streams `Event` messages back. `web` is a SvelteKit app using `@sveltejs/adapter-static` — built to static HTML/JS/CSS that the Bun server serves. During development, SvelteKit's Vite dev server runs on Node. The web app communicates exclusively via WebSocket + REST.

**Tech Stack:** Bun.serve (server), SvelteKit + Svelte 5, shadcn-svelte, Tailwind CSS v4, bits-ui, marked (streaming markdown), shiki (syntax highlighting), Monaco Editor (lazy-loaded diff viewer)

**Depends on:** Phase 3 (core engine must be complete)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` — sections 4, 5

---

## File Structure

### packages/server/

```
packages/server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports: startServer, ServerOptions
│   ├── http.ts                    ← Bun.serve setup, static file serving, REST routes
│   ├── ws-handler.ts              ← WebSocket upgrade, message routing, auth check
│   ├── rest-routes.ts             ← REST endpoint handlers (health, sessions, config)
│   └── auth-guard.ts              ← Token validation for WS + REST
└── tests/
    ├── http.test.ts               ← HTTP endpoint tests
    ├── ws-handler.test.ts         ← WebSocket message routing tests
    └── auth-guard.test.ts         ← Token validation tests
```

### packages/web/

```
packages/web/
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── app.html                   ← HTML shell
│   ├── app.css                    ← Tailwind v4 imports + global styles
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── connection.ts      ← WebSocket connection store
│   │   │   ├── session.ts         ← Active session state store
│   │   │   ├── messages.ts        ← Message list store (streaming updates)
│   │   │   └── ui.ts              ← UI state (sidebar open, settings panel, etc.)
│   │   ├── ws/
│   │   │   ├── client.ts          ← WebSocket client (connect, send, reconnect)
│   │   │   └── protocol.ts        ← Type-safe Submission/Event helpers
│   │   ├── components/
│   │   │   ├── Header.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── SessionList.svelte
│   │   │   ├── SessionItem.svelte
│   │   │   ├── ChatArea.svelte
│   │   │   ├── MessageList.svelte
│   │   │   ├── MessageBubble.svelte
│   │   │   ├── UserMessage.svelte
│   │   │   ├── AgentMessage.svelte
│   │   │   ├── ReasoningBlock.svelte
│   │   │   ├── ShellOutput.svelte
│   │   │   ├── ToolCallCard.svelte
│   │   │   ├── ApprovalCard.svelte
│   │   │   ├── InputComposer.svelte
│   │   │   ├── StatusBar.svelte
│   │   │   ├── ModelSelector.svelte
│   │   │   ├── AuthGate.svelte
│   │   │   ├── ConnectionStatus.svelte
│   │   │   └── DiffViewer.svelte  ← Monaco diff (lazy-loaded)
│   │   └── utils/
│   │       ├── markdown.ts        ← Streaming markdown renderer (marked + shiki)
│   │       └── auto-scroll.ts     ← Auto-scroll behavior helper
│   └── routes/
│       └── +page.svelte           ← Single-page app entry
└── static/
    └── favicon.svg
```

---

## Task 1: Server Package — Auth Guard + REST Routes

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/auth-guard.ts`
- Create: `packages/server/src/rest-routes.ts`
- Create: `packages/server/tests/auth-guard.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package.json**

`packages/server/package.json`:
```json
{
  "name": "@clawdex/server",
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
    "@clawdex/core": "workspace:*"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`packages/server/tsconfig.json`:
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
    { "path": "../core" }
  ]
}
```

- [ ] **Step 3: Write the auth guard test**

`packages/server/tests/auth-guard.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { validateToken, extractTokenFromUrl, extractTokenFromHeader } from "../src/auth-guard.js";

describe("validateToken", () => {
  test("returns true for matching token", () => {
    expect(validateToken("abc123", "abc123")).toBe(true);
  });

  test("returns false for mismatched token", () => {
    expect(validateToken("abc123", "wrong")).toBe(false);
  });

  test("returns false for empty token", () => {
    expect(validateToken("abc123", "")).toBe(false);
    expect(validateToken("abc123", undefined)).toBe(false);
  });
});

describe("extractTokenFromUrl", () => {
  test("extracts token query parameter", () => {
    const url = "http://localhost:3141/?token=mytoken123";
    expect(extractTokenFromUrl(url)).toBe("mytoken123");
  });

  test("returns null when no token param", () => {
    expect(extractTokenFromUrl("http://localhost:3141/")).toBeNull();
  });
});

describe("extractTokenFromHeader", () => {
  test("extracts Bearer token", () => {
    expect(extractTokenFromHeader("Bearer mytoken123")).toBe("mytoken123");
  });

  test("returns null for non-Bearer auth", () => {
    expect(extractTokenFromHeader("Basic abc")).toBeNull();
  });

  test("returns null for missing header", () => {
    expect(extractTokenFromHeader(undefined)).toBeNull();
  });
});
```

- [ ] **Step 4: Write the auth guard**

`packages/server/src/auth-guard.ts`:
```typescript
/**
 * Validate that a provided token matches the server's expected token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateToken(
  expected: string,
  provided: string | undefined | null,
): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Extract the token from a URL's query string (?token=...). */
export function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

/** Extract Bearer token from an Authorization header. */
export function extractTokenFromHeader(
  header: string | undefined | null,
): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
```

- [ ] **Step 5: Write the REST routes**

`packages/server/src/rest-routes.ts`:
```typescript
import type { ClawdexEngine } from "@clawdex/core";

export interface RouteContext {
  engine: ClawdexEngine;
  serverVersion: string;
}

/** Handle REST API requests. Returns a Response or null (not matched). */
export async function handleRestRequest(
  req: Request,
  ctx: RouteContext,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/health" && req.method === "GET") {
    return Response.json({
      status: "ok",
      version: ctx.serverVersion,
      uptime: process.uptime(),
    });
  }

  if (path === "/api/sessions" && req.method === "GET") {
    const sessions = await ctx.engine.listSessions();
    return Response.json({ sessions });
  }

  if (path === "/api/config" && req.method === "GET") {
    return Response.json({ config: ctx.engine.config });
  }

  return null; // Not a REST route
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/server && bun test tests/auth-guard.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/ tsconfig.build.json
git commit -m "feat(server): scaffold package with auth guard and REST routes"
```

---

## Task 2: Server — WebSocket Handler + Bun.serve

**Files:**
- Create: `packages/server/src/ws-handler.ts`
- Create: `packages/server/src/http.ts`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/tests/ws-handler.test.ts`

- [ ] **Step 1: Write the WebSocket handler test**

`packages/server/tests/ws-handler.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { parseSubmission, routeSubmission } from "../src/ws-handler.js";
import type { Submission, Op } from "@clawdex/shared-types";

describe("parseSubmission", () => {
  test("parses a valid JSON submission", () => {
    const raw = JSON.stringify({
      id: "sub-1",
      op: { type: "user_turn", prompt: "hello", sessionId: "sess-1" },
    });
    const result = parseSubmission(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub-1");
    expect(result!.op.type).toBe("user_turn");
  });

  test("returns null for invalid JSON", () => {
    expect(parseSubmission("not json")).toBeNull();
  });

  test("returns null for missing id", () => {
    expect(parseSubmission(JSON.stringify({ op: { type: "interrupt" } }))).toBeNull();
  });

  test("returns null for missing op", () => {
    expect(parseSubmission(JSON.stringify({ id: "sub-1" }))).toBeNull();
  });

  test("returns null for missing op.type", () => {
    expect(parseSubmission(JSON.stringify({ id: "sub-1", op: {} }))).toBeNull();
  });
});

describe("routeSubmission", () => {
  test("returns the correct handler name for known op types", () => {
    expect(routeSubmission({ type: "user_turn", prompt: "hi", sessionId: "s1" } as Op)).toBe("userTurn");
    expect(routeSubmission({ type: "interrupt" } as Op)).toBe("interrupt");
    expect(routeSubmission({ type: "create_session" } as Op)).toBe("createSession");
    expect(routeSubmission({ type: "list_sessions" } as Op)).toBe("listSessions");
    expect(routeSubmission({ type: "shutdown" } as Op)).toBe("shutdown");
    expect(routeSubmission({ type: "compact" } as Op)).toBe("compact");
    expect(routeSubmission({ type: "undo" } as Op)).toBe("undo");
  });

  test("returns null for unknown op type", () => {
    expect(routeSubmission({ type: "unknown_op" } as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the WebSocket handler**

`packages/server/src/ws-handler.ts`:
```typescript
import type { Submission, Op } from "@clawdex/shared-types";

/** Parse a raw WebSocket message string into a typed Submission. */
export function parseSubmission(raw: string): Submission | null {
  try {
    const data = JSON.parse(raw);
    if (!data.id || !data.op || !data.op.type) return null;
    return data as Submission;
  } catch {
    return null;
  }
}

/** Route op type to handler name. Returns null for unknown ops. */
export function routeSubmission(op: Op): string | null {
  const routes: Record<string, string> = {
    user_turn: "userTurn",
    interrupt: "interrupt",
    undo: "undo",
    compact: "compact",
    shutdown: "shutdown",
    exec_approval: "execApproval",
    patch_approval: "patchApproval",
    create_session: "createSession",
    load_session: "loadSession",
    delete_session: "deleteSession",
    set_session_name: "setSessionName",
    list_sessions: "listSessions",
    list_models: "listModels",
    reload_config: "reloadConfig",
    start_oauth: "startOAuth",
    logout: "logout",
    run_user_shell_command: "runUserShellCommand",
    list_mcp_tools: "listMcpTools",
    refresh_mcp_servers: "refreshMcpServers",
    list_skills: "listSkills",
    update_memories: "updateMemories",
    drop_memories: "dropMemories",
    mcp_elicitation_response: "mcpElicitationResponse",
  };
  return routes[op.type] ?? null;
}
```

- [ ] **Step 3: Write the HTTP server + main entry**

`packages/server/src/http.ts`:
```typescript
import type { Server, ServerWebSocket } from "bun";
import type { ClawdexEngine } from "@clawdex/core";
import type { EventMsg, Submission, Event } from "@clawdex/shared-types";
import { validateToken, extractTokenFromUrl, extractTokenFromHeader } from "./auth-guard.js";
import { handleRestRequest, type RouteContext } from "./rest-routes.js";
import { parseSubmission, routeSubmission } from "./ws-handler.js";
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

export interface ServerConfig {
  engine: ClawdexEngine;
  host: string;
  port: number;
  token: string;
  staticDir?: string;
  version?: string;
}

interface WsData {
  authenticated: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function createServer(config: ServerConfig): Server {
  const { engine, host, port, token, staticDir, version = "0.0.1" } = config;
  const routeCtx: RouteContext = { engine, serverVersion: version };
  const wsClients = new Set<ServerWebSocket<WsData>>();

  // Forward engine events to all connected WS clients
  engine.on("event", (msg: EventMsg) => {
    const event: Event = { msg };
    const json = JSON.stringify(event);
    for (const ws of wsClients) {
      if (ws.data.authenticated) {
        ws.send(json);
      }
    }
  });

  return Bun.serve<WsData>({
    hostname: host,
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const wsToken = extractTokenFromUrl(req.url);
        if (!validateToken(token, wsToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const success = server.upgrade(req, {
          data: { authenticated: true },
        });
        return success ? undefined : new Response("Upgrade failed", { status: 500 });
      }

      // REST API auth check
      if (url.pathname.startsWith("/api/")) {
        const headerToken = extractTokenFromHeader(
          req.headers.get("authorization")
        );
        if (!validateToken(token, headerToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const restResponse = await handleRestRequest(req, routeCtx);
        if (restResponse) return restResponse;
        return new Response("Not Found", { status: 404 });
      }

      // Static file serving (web UI)
      if (staticDir) {
        return await serveStaticFile(url.pathname, staticDir);
      }

      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws) {
        wsClients.add(ws);
        // Send connection_ready event
        const readyEvent: Event = {
          msg: {
            type: "connection_ready",
            serverVersion: version,
            authStatus: { authenticated: true, method: "api_key" },
          } as EventMsg,
        };
        ws.send(JSON.stringify(readyEvent));
      },

      async message(ws, raw) {
        const submission = parseSubmission(String(raw));
        if (!submission) {
          ws.send(JSON.stringify({
            msg: { type: "error", message: "Invalid submission", code: "INVALID_SUBMISSION", fatal: false },
          }));
          return;
        }

        const handler = routeSubmission(submission.op);
        if (!handler) {
          ws.send(JSON.stringify({
            submissionId: submission.id,
            msg: { type: "error", message: `Unknown op: ${submission.op.type}`, code: "INVALID_SUBMISSION", fatal: false },
          }));
          return;
        }

        // Route to engine based on op type
        try {
          await handleOp(engine, submission);
        } catch (err) {
          ws.send(JSON.stringify({
            submissionId: submission.id,
            msg: { type: "error", message: String(err), fatal: false },
          }));
        }
      },

      close(ws) {
        wsClients.delete(ws);
      },
    },
  });
}

async function handleOp(engine: ClawdexEngine, sub: Submission): Promise<void> {
  const op = sub.op;

  switch (op.type) {
    case "user_turn":
      await engine.runTurn(op.sessionId, {
        prompt: op.prompt,
        model: op.model,
        effort: op.effort,
      });
      break;
    case "interrupt":
      engine.interrupt();
      break;
    case "undo":
      // Need session id from active session — handled by engine
      break;
    case "compact":
      break;
    case "create_session":
      await engine.createSession({
        workingDir: op.workingDir ?? process.cwd(),
        name: op.name,
      });
      break;
    case "load_session":
      await engine.loadSession(op.sessionId);
      break;
    case "delete_session":
      await engine.deleteSession(op.sessionId);
      break;
    case "set_session_name":
      await engine.setSessionName(op.sessionId, op.name);
      break;
    case "list_sessions": {
      const sessions = await engine.listSessions();
      await engine.emit({
        type: "session_list",
        sessions,
      } as EventMsg);
      break;
    }
    case "shutdown":
      await engine.emit({ type: "shutdown_complete" } as EventMsg);
      break;
  }
}

async function serveStaticFile(pathname: string, staticDir: string): Promise<Response> {
  let filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch {
    // Try with .html extension or fall back to index.html (SPA)
    filePath = join(staticDir, "index.html");
  }

  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      // SPA fallback
      const index = Bun.file(join(staticDir, "index.html"));
      return new Response(index, {
        headers: { "Content-Type": "text/html" },
      });
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
```

- [ ] **Step 4: Write server index.ts**

`packages/server/src/index.ts`:
```typescript
export { createServer } from "./http.js";
export type { ServerConfig } from "./http.js";
export { validateToken, extractTokenFromUrl, extractTokenFromHeader } from "./auth-guard.js";
export { parseSubmission, routeSubmission } from "./ws-handler.js";
export { handleRestRequest } from "./rest-routes.js";
export type { RouteContext } from "./rest-routes.js";
```

- [ ] **Step 5: Run tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat(server): add Bun HTTP/WS server with auth, REST routes, static serving"
```

---

## Task 3: Web Package — SvelteKit Scaffolding

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/svelte.config.js`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/src/app.html`
- Create: `packages/web/src/app.css`
- Create: `packages/web/src/routes/+page.svelte`
- Create: `packages/web/static/favicon.svg`
- Create: `packages/web/tailwind.config.ts`

- [ ] **Step 1: Create package.json**

`packages/web/package.json`:
```json
{
  "name": "@clawdex/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@clawdex/shared-types": "workspace:*",
    "@sveltejs/adapter-static": "^3.0.8",
    "@sveltejs/kit": "^2.16.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.3",
    "svelte": "^5.28.0",
    "svelte-check": "^4.2.0",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/vite": "^4.1.0",
    "bits-ui": "^1.3.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.2",
    "tailwind-variants": "^1.0.0",
    "marked": "^15.0.7",
    "shiki": "^3.2.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.0"
  }
}
```

- [ ] **Step 2: Create svelte.config.js**

`packages/web/svelte.config.js`:
```javascript
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html",
      precompress: false,
    }),
  },
};

export default config;
```

- [ ] **Step 3: Create vite.config.ts**

`packages/web/vite.config.ts`:
```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

- [ ] **Step 4: Create tsconfig.json**

`packages/web/tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 5: Create app.html and app.css**

`packages/web/src/app.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Clawdex</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

`packages/web/src/app.css`:
```css
@import "tailwindcss";

:root {
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}

body {
  @apply bg-background text-foreground;
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Create the main page route**

`packages/web/src/routes/+page.svelte`:
```svelte
<script lang="ts">
  // Placeholder — will be filled in subsequent tasks
</script>

<div class="flex h-screen flex-col">
  <header class="flex h-12 items-center border-b px-4">
    <h1 class="text-lg font-semibold">Clawdex</h1>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 border-r p-4">
      <p class="text-sm text-muted-foreground">Sessions</p>
    </aside>

    <!-- Main chat area -->
    <main class="flex flex-1 flex-col">
      <div class="flex-1 overflow-y-auto p-4">
        <p class="text-muted-foreground">Start a conversation...</p>
      </div>

      <!-- Input composer -->
      <div class="border-t p-4">
        <div class="flex gap-2">
          <textarea
            class="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
            rows="1"
            placeholder="Type a message..."
          ></textarea>
          <button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Send
          </button>
        </div>
      </div>
    </main>
  </div>

  <!-- Status bar -->
  <footer class="flex h-8 items-center border-t px-4 text-xs text-muted-foreground">
    <span>Ready</span>
  </footer>
</div>
```

- [ ] **Step 7: Create favicon**

`packages/web/static/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <text x="4" y="26" font-size="28" font-family="monospace">C</text>
</svg>
```

- [ ] **Step 8: Install dependencies and verify build**

Run:
```bash
cd packages/web && pnpm install && pnpm build
```
Expected: Static build outputs to `packages/web/build/`.

- [ ] **Step 9: Commit**

```bash
git add packages/web/
git commit -m "feat(web): scaffold SvelteKit app with adapter-static and Tailwind v4"
```

---

## Task 4: Web — WebSocket Client + Stores

**Files:**
- Create: `packages/web/src/lib/ws/client.ts`
- Create: `packages/web/src/lib/ws/protocol.ts`
- Create: `packages/web/src/lib/stores/connection.ts`
- Create: `packages/web/src/lib/stores/session.ts`
- Create: `packages/web/src/lib/stores/messages.ts`
- Create: `packages/web/src/lib/stores/ui.ts`

- [ ] **Step 1: Create the WS protocol helpers**

`packages/web/src/lib/ws/protocol.ts`:
```typescript
import type { Submission, Op, Event, EventMsg } from "@clawdex/shared-types";

let submissionCounter = 0;

/** Create a typed Submission message. */
export function createSubmission(op: Op): Submission {
  return {
    id: `sub-${++submissionCounter}-${Date.now()}`,
    op,
  };
}

/** Parse a raw WS message into an Event. Returns null if invalid. */
export function parseEvent(raw: string): Event | null {
  try {
    const data = JSON.parse(raw);
    if (!data.msg || !data.msg.type) return null;
    return data as Event;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create the WebSocket client**

`packages/web/src/lib/ws/client.ts`:
```typescript
import { parseEvent, createSubmission } from "./protocol.js";
import type { Op, Event, EventMsg } from "@clawdex/shared-types";

export type EventHandler = (event: Event) => void;

export class ClawdexWsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Set<EventHandler>();
  private reconnectAttempt = 0;
  private maxReconnectDelay = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    this.ws.onmessage = (event) => {
      const parsed = parseEvent(String(event.data));
      if (parsed) {
        for (const handler of this.handlers) {
          handler(parsed);
        }
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(op: Op): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const submission = createSubmission(op);
    this.ws.send(JSON.stringify(submission));
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      100 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
```

- [ ] **Step 3: Create Svelte stores**

`packages/web/src/lib/stores/connection.ts`:
```typescript
import { writable } from "svelte/store";
import { ClawdexWsClient } from "../ws/client.js";

export const connectionStatus = writable<"connecting" | "connected" | "disconnected">("disconnected");
export const wsClient = writable<ClawdexWsClient | null>(null);

export function initConnection(host: string, port: number, token: string) {
  const url = `ws://${host}:${port}/?token=${encodeURIComponent(token)}`;
  const client = new ClawdexWsClient(url);

  client.onEvent((event) => {
    if (event.msg.type === "connection_ready") {
      connectionStatus.set("connected");
    }
  });

  connectionStatus.set("connecting");
  client.connect();
  wsClient.set(client);

  return client;
}
```

`packages/web/src/lib/stores/session.ts`:
```typescript
import { writable, derived } from "svelte/store";
import type { SessionSummary, SessionSnapshot } from "@clawdex/shared-types";

export const activeSessionId = writable<string | null>(null);
export const sessionList = writable<SessionSummary[]>([]);
export const activeSnapshot = writable<SessionSnapshot | null>(null);
```

`packages/web/src/lib/stores/messages.ts`:
```typescript
import { writable, derived } from "svelte/store";

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  streaming?: boolean;
  reasoning?: string;
  toolCalls?: UIToolCall[];
}

export interface UIToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output?: string;
  success?: boolean;
  status: "pending" | "running" | "complete";
}

export const messages = writable<UIMessage[]>([]);
export const streamingDelta = writable<string>("");
export const isStreaming = writable<boolean>(false);
```

`packages/web/src/lib/stores/ui.ts`:
```typescript
import { writable } from "svelte/store";

export const sidebarOpen = writable(true);
export const settingsPanelOpen = writable(false);
export const selectedModel = writable("gpt-4o");
export const autoScroll = writable(true);
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/
git commit -m "feat(web): add WebSocket client, protocol helpers, and Svelte stores"
```

---

## Task 5: Web — Core UI Components

**Files:**
- Create: `packages/web/src/lib/components/Header.svelte`
- Create: `packages/web/src/lib/components/Sidebar.svelte`
- Create: `packages/web/src/lib/components/SessionList.svelte`
- Create: `packages/web/src/lib/components/ChatArea.svelte`
- Create: `packages/web/src/lib/components/MessageList.svelte`
- Create: `packages/web/src/lib/components/InputComposer.svelte`
- Create: `packages/web/src/lib/components/StatusBar.svelte`
- Modify: `packages/web/src/routes/+page.svelte`

- [ ] **Step 1: Create Header component**

`packages/web/src/lib/components/Header.svelte`:
```svelte
<script lang="ts">
  import { selectedModel } from "../stores/ui.js";
  import { connectionStatus } from "../stores/connection.js";

  const models = ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"];
</script>

<header class="flex h-12 items-center justify-between border-b px-4">
  <h1 class="text-lg font-semibold">Clawdex</h1>
  <div class="flex items-center gap-3">
    <select
      bind:value={$selectedModel}
      class="rounded-md border bg-background px-2 py-1 text-sm"
    >
      {#each models as model}
        <option value={model}>{model}</option>
      {/each}
    </select>
    <div class="flex items-center gap-1.5">
      <div
        class="h-2 w-2 rounded-full"
        class:bg-green-500={$connectionStatus === "connected"}
        class:bg-yellow-500={$connectionStatus === "connecting"}
        class:bg-red-500={$connectionStatus === "disconnected"}
      ></div>
      <span class="text-xs text-muted-foreground">{$connectionStatus}</span>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Create Sidebar + SessionList**

`packages/web/src/lib/components/Sidebar.svelte`:
```svelte
<script lang="ts">
  import SessionList from "./SessionList.svelte";
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  function handleNewSession() {
    $wsClient?.send({ type: "create_session" } as Op);
  }
</script>

<aside class="flex w-64 flex-col border-r">
  <div class="flex items-center justify-between p-3">
    <span class="text-sm font-medium">Sessions</span>
    <button
      onclick={handleNewSession}
      class="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
    >
      + New
    </button>
  </div>
  <div class="flex-1 overflow-y-auto">
    <SessionList />
  </div>
</aside>
```

`packages/web/src/lib/components/SessionList.svelte`:
```svelte
<script lang="ts">
  import { sessionList, activeSessionId } from "../stores/session.js";
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  function selectSession(id: string) {
    $activeSessionId = id;
    $wsClient?.send({ type: "load_session", sessionId: id } as Op);
  }
</script>

<ul class="space-y-1 px-2">
  {#each $sessionList as session (session.id)}
    <li>
      <button
        onclick={() => selectSession(session.id)}
        class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
        class:bg-accent={$activeSessionId === session.id}
      >
        <div class="truncate font-medium">
          {session.name || `Session ${session.id.slice(0, 6)}`}
        </div>
        <div class="text-xs text-muted-foreground">
          {session.messageCount} messages
        </div>
      </button>
    </li>
  {/each}
</ul>
```

- [ ] **Step 3: Create ChatArea + MessageList**

`packages/web/src/lib/components/ChatArea.svelte`:
```svelte
<script lang="ts">
  import MessageList from "./MessageList.svelte";
  import InputComposer from "./InputComposer.svelte";
</script>

<main class="flex flex-1 flex-col overflow-hidden">
  <div class="flex-1 overflow-y-auto">
    <MessageList />
  </div>
  <InputComposer />
</main>
```

`packages/web/src/lib/components/MessageList.svelte`:
```svelte
<script lang="ts">
  import { messages, streamingDelta, isStreaming } from "../stores/messages.js";
  import UserMessage from "./UserMessage.svelte";
  import AgentMessage from "./AgentMessage.svelte";

  let scrollContainer: HTMLDivElement;

  // Auto-scroll on new messages
  $effect(() => {
    if ($messages.length || $streamingDelta) {
      scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
    }
  });
</script>

<div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-4">
  {#if $messages.length === 0 && !$isStreaming}
    <div class="flex h-full items-center justify-center">
      <p class="text-muted-foreground">Start a conversation...</p>
    </div>
  {:else}
    <div class="mx-auto max-w-3xl space-y-4">
      {#each $messages as msg (msg.id)}
        {#if msg.role === "user"}
          <UserMessage content={msg.content} />
        {:else if msg.role === "assistant"}
          <AgentMessage content={msg.content} streaming={msg.streaming} />
        {/if}
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Create UserMessage + AgentMessage components**

`packages/web/src/lib/components/UserMessage.svelte`:
```svelte
<script lang="ts">
  interface Props {
    content: string;
  }
  let { content }: Props = $props();
</script>

<div class="flex justify-end">
  <div class="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
    <p class="whitespace-pre-wrap text-sm">{content}</p>
  </div>
</div>
```

`packages/web/src/lib/components/AgentMessage.svelte`:
```svelte
<script lang="ts">
  interface Props {
    content: string;
    streaming?: boolean;
  }
  let { content, streaming = false }: Props = $props();
</script>

<div class="flex justify-start">
  <div class="max-w-[80%] rounded-lg bg-muted px-4 py-2">
    <div class="prose prose-sm dark:prose-invert">
      {#if content}
        <p class="whitespace-pre-wrap text-sm">{content}</p>
      {/if}
      {#if streaming}
        <span class="inline-block h-4 w-1 animate-pulse bg-foreground"></span>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Create InputComposer**

`packages/web/src/lib/components/InputComposer.svelte`:
```svelte
<script lang="ts">
  import { wsClient } from "../stores/connection.js";
  import { activeSessionId } from "../stores/session.js";
  import { isStreaming } from "../stores/messages.js";
  import { selectedModel } from "../stores/ui.js";
  import type { Op } from "@clawdex/shared-types";

  let input = $state("");

  function send() {
    if (!input.trim() || !$activeSessionId) return;

    $wsClient?.send({
      type: "user_turn",
      prompt: input.trim(),
      sessionId: $activeSessionId,
      model: $selectedModel,
    } as Op);

    input = "";
  }

  function interrupt() {
    $wsClient?.send({ type: "interrupt" } as Op);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ($isStreaming) {
        interrupt();
      } else {
        send();
      }
    }
  }
</script>

<div class="border-t p-4">
  <div class="mx-auto flex max-w-3xl gap-2">
    <textarea
      bind:value={input}
      onkeydown={handleKeydown}
      class="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      rows="1"
      placeholder={$activeSessionId ? "Type a message..." : "Create or select a session first"}
      disabled={!$activeSessionId}
    ></textarea>
    {#if $isStreaming}
      <button
        onclick={interrupt}
        class="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground"
      >
        Stop
      </button>
    {:else}
      <button
        onclick={send}
        disabled={!input.trim() || !$activeSessionId}
        class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        Send
      </button>
    {/if}
  </div>
</div>
```

- [ ] **Step 6: Create StatusBar**

`packages/web/src/lib/components/StatusBar.svelte`:
```svelte
<script lang="ts">
  import { connectionStatus } from "../stores/connection.js";
  import { activeSnapshot } from "../stores/session.js";
</script>

<footer class="flex h-8 items-center justify-between border-t px-4 text-xs text-muted-foreground">
  <span>
    {#if $activeSnapshot}
      Sandbox: {$activeSnapshot.sandboxPolicy}
    {:else}
      Ready
    {/if}
  </span>
  <span>{$connectionStatus}</span>
</footer>
```

- [ ] **Step 7: Update +page.svelte to compose all components**

`packages/web/src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import ChatArea from "$lib/components/ChatArea.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import { initConnection } from "$lib/stores/connection.js";
  import { onMount } from "svelte";

  onMount(() => {
    // Extract connection params from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    const host = window.location.hostname || "127.0.0.1";
    const port = parseInt(window.location.port || "3141", 10);

    if (token) {
      // Store token in sessionStorage for reconnects
      sessionStorage.setItem("clawdex-token", token);
      initConnection(host, port, token);
    } else {
      const stored = sessionStorage.getItem("clawdex-token");
      if (stored) {
        initConnection(host, port, stored);
      }
    }
  });
</script>

<div class="flex h-screen flex-col">
  <Header />
  <div class="flex flex-1 overflow-hidden">
    <Sidebar />
    <ChatArea />
  </div>
  <StatusBar />
</div>
```

- [ ] **Step 8: Verify build**

Run: `cd packages/web && pnpm build`
Expected: Builds to `packages/web/build/` successfully.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/
git commit -m "feat(web): add core UI components (header, sidebar, chat, input, messages)"
```

---

## Task 6: Web — Tool Call Cards + Shell Output + Approval Cards

**Files:**
- Create: `packages/web/src/lib/components/ToolCallCard.svelte`
- Create: `packages/web/src/lib/components/ShellOutput.svelte`
- Create: `packages/web/src/lib/components/ApprovalCard.svelte`
- Create: `packages/web/src/lib/components/ReasoningBlock.svelte`

- [ ] **Step 1: Create ToolCallCard**

`packages/web/src/lib/components/ToolCallCard.svelte`:
```svelte
<script lang="ts">
  import type { UIToolCall } from "../stores/messages.js";

  interface Props {
    toolCall: UIToolCall;
  }
  let { toolCall }: Props = $props();
  let expanded = $state(false);
</script>

<div class="rounded-md border bg-card p-3">
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center justify-between text-sm"
  >
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs font-medium">{toolCall.tool}</span>
      {#if toolCall.status === "running"}
        <span class="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></span>
      {:else if toolCall.success}
        <span class="text-green-500">done</span>
      {:else if toolCall.success === false}
        <span class="text-red-500">failed</span>
      {/if}
    </div>
    <span class="text-xs text-muted-foreground">{expanded ? "collapse" : "expand"}</span>
  </button>

  {#if expanded}
    <div class="mt-2 space-y-2">
      <div>
        <p class="text-xs font-medium text-muted-foreground">Arguments</p>
        <pre class="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(toolCall.args, null, 2)}</pre>
      </div>
      {#if toolCall.output !== undefined}
        <div>
          <p class="text-xs font-medium text-muted-foreground">Output</p>
          <pre class="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">{toolCall.output}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Create ShellOutput**

`packages/web/src/lib/components/ShellOutput.svelte`:
```svelte
<script lang="ts">
  interface Props {
    command: string;
    output: string;
    exitCode?: number;
    stream?: "stdout" | "stderr";
  }
  let { command, output, exitCode, stream = "stdout" }: Props = $props();
</script>

<div class="rounded-md bg-zinc-900 p-3 font-mono text-sm">
  <div class="mb-1 flex items-center gap-2 text-xs text-zinc-400">
    <span>$</span>
    <span class="font-medium text-zinc-200">{command}</span>
    {#if exitCode !== undefined}
      <span class:text-green-400={exitCode === 0} class:text-red-400={exitCode !== 0}>
        exit {exitCode}
      </span>
    {/if}
  </div>
  <pre
    class="max-h-60 overflow-auto whitespace-pre-wrap"
    class:text-zinc-200={stream === "stdout"}
    class:text-red-400={stream === "stderr"}
  >{output}</pre>
</div>
```

- [ ] **Step 3: Create ApprovalCard**

`packages/web/src/lib/components/ApprovalCard.svelte`:
```svelte
<script lang="ts">
  import { wsClient } from "../stores/connection.js";
  import type { Op } from "@clawdex/shared-types";

  interface Props {
    type: "exec" | "patch";
    callId: string;
    command?: string;
    path?: string;
    risk?: string;
  }
  let { type, callId, command, path, risk = "medium" }: Props = $props();

  let decided = $state(false);

  function approve() {
    decided = true;
    const op = type === "exec"
      ? { type: "exec_approval", callId, decision: "approve" } as Op
      : { type: "patch_approval", callId, decision: "approve" } as Op;
    $wsClient?.send(op);
  }

  function deny() {
    decided = true;
    const op = type === "exec"
      ? { type: "exec_approval", callId, decision: "deny" } as Op
      : { type: "patch_approval", callId, decision: "deny" } as Op;
    $wsClient?.send(op);
  }
</script>

<div class="rounded-md border-2 p-4"
  class:border-yellow-500={risk === "medium"}
  class:border-red-500={risk === "high"}
  class:border-green-500={risk === "low"}
>
  <div class="mb-2 flex items-center gap-2">
    <span class="rounded px-2 py-0.5 text-xs font-medium"
      class:bg-yellow-100={risk === "medium"}
      class:bg-red-100={risk === "high"}
      class:bg-green-100={risk === "low"}
    >
      {risk} risk
    </span>
    <span class="text-sm font-medium">
      {type === "exec" ? "Command Approval" : "Patch Approval"}
    </span>
  </div>

  {#if command}
    <pre class="mb-3 rounded bg-muted p-2 text-xs font-mono">{command}</pre>
  {/if}
  {#if path}
    <p class="mb-3 text-sm">File: <code class="rounded bg-muted px-1">{path}</code></p>
  {/if}

  {#if !decided}
    <div class="flex gap-2">
      <button
        onclick={approve}
        class="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white"
      >
        Approve
      </button>
      <button
        onclick={deny}
        class="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
      >
        Deny
      </button>
    </div>
  {:else}
    <p class="text-xs text-muted-foreground">Decision submitted.</p>
  {/if}
</div>
```

- [ ] **Step 4: Create ReasoningBlock**

`packages/web/src/lib/components/ReasoningBlock.svelte`:
```svelte
<script lang="ts">
  interface Props {
    content: string;
  }
  let { content }: Props = $props();
  let expanded = $state(false);
</script>

<div class="rounded-md border bg-muted/50 p-3">
  <button
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center gap-2 text-xs text-muted-foreground"
  >
    <span class="font-medium">Reasoning</span>
    <span>{expanded ? "hide" : "show"}</span>
  </button>
  {#if expanded}
    <div class="mt-2 text-sm text-muted-foreground">
      <p class="whitespace-pre-wrap">{content}</p>
    </div>
  {/if}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/components/
git commit -m "feat(web): add ToolCallCard, ShellOutput, ApprovalCard, ReasoningBlock"
```

---

## Task 7: Web — Markdown Renderer + Event Router

**Files:**
- Create: `packages/web/src/lib/utils/markdown.ts`
- Create: `packages/web/src/lib/utils/auto-scroll.ts`
- Create: `packages/web/src/lib/ws/event-router.ts`

- [ ] **Step 1: Create streaming markdown renderer**

`packages/web/src/lib/utils/markdown.ts`:
```typescript
import { marked } from "marked";

/** Render markdown to HTML. Uses marked for streaming-friendly rendering. */
export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false, breaks: true }) as string;
}
```

- [ ] **Step 2: Create auto-scroll helper**

`packages/web/src/lib/utils/auto-scroll.ts`:
```typescript
/**
 * Check if a scrollable element is near the bottom.
 * Returns true if within `threshold` pixels of the bottom.
 */
export function isNearBottom(el: HTMLElement, threshold = 100): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/** Scroll element to the bottom smoothly. */
export function scrollToBottom(el: HTMLElement, smooth = true): void {
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
}
```

- [ ] **Step 3: Create event router**

This is the central piece that routes WS events to the Svelte stores.

`packages/web/src/lib/ws/event-router.ts`:
```typescript
import type { Event, EventMsg } from "@clawdex/shared-types";
import {
  messages,
  streamingDelta,
  isStreaming,
  type UIMessage,
  type UIToolCall,
} from "../stores/messages.js";
import { sessionList, activeSessionId, activeSnapshot } from "../stores/session.js";
import { connectionStatus } from "../stores/connection.js";
import { get } from "svelte/store";

/** Route a server event to the appropriate store updates. */
export function routeEvent(event: Event): void {
  const msg = event.msg;

  switch (msg.type) {
    case "connection_ready":
      connectionStatus.set("connected");
      break;

    case "turn_started":
      isStreaming.set(true);
      streamingDelta.set("");
      break;

    case "agent_message_delta":
      streamingDelta.update((d) => d + (msg as any).delta);
      break;

    case "agent_message": {
      isStreaming.set(false);
      const delta = get(streamingDelta);
      streamingDelta.set("");
      messages.update((msgs) => [
        ...msgs,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: (msg as any).message || delta,
          timestamp: new Date().toISOString(),
          streaming: false,
        },
      ]);
      break;
    }

    case "turn_complete":
      isStreaming.set(false);
      streamingDelta.set("");
      break;

    case "turn_aborted":
      isStreaming.set(false);
      streamingDelta.set("");
      break;

    case "tool_call_begin": {
      const tc = msg as any;
      messages.update((msgs) => {
        // Add tool call card to last assistant message or create new one
        return [
          ...msgs,
          {
            id: `tc-${tc.callId}`,
            role: "system" as const,
            content: `Tool: ${tc.tool}`,
            timestamp: new Date().toISOString(),
            toolCalls: [{
              callId: tc.callId,
              tool: tc.tool,
              args: tc.args,
              status: "running" as const,
            }],
          },
        ];
      });
      break;
    }

    case "tool_call_end": {
      const tc = msg as any;
      messages.update((msgs) =>
        msgs.map((m) => {
          if (m.toolCalls?.[0]?.callId === tc.callId) {
            return {
              ...m,
              toolCalls: m.toolCalls!.map((t) =>
                t.callId === tc.callId
                  ? { ...t, output: tc.output, success: tc.success, status: "complete" as const }
                  : t
              ),
            };
          }
          return m;
        })
      );
      break;
    }

    case "session_list":
      sessionList.set((msg as any).sessions);
      break;

    case "session_created": {
      const created = msg as any;
      activeSessionId.set(created.sessionId);
      break;
    }

    case "session_loaded":
      activeSnapshot.set((msg as any).session);
      break;

    case "error":
      console.error("[clawdex]", (msg as any).message);
      break;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/utils/ packages/web/src/lib/ws/event-router.ts
git commit -m "feat(web): add markdown renderer, auto-scroll, and WS event router"
```

---

## Task 8: Final Verification — Build + Integration Test

- [ ] **Step 1: Run full web build**

Run:
```bash
cd packages/web && pnpm build
```
Expected: Static build succeeds, outputs to `packages/web/build/`.

- [ ] **Step 2: Run server tests**

Run:
```bash
cd packages/server && bun test
```
Expected: All tests PASS.

- [ ] **Step 3: Run monorepo typecheck**

Run:
```bash
pnpm -r run typecheck
```
Expected: No errors across all packages.

- [ ] **Step 4: Verify static serving integration**

Create a quick integration test: start the server with the built web assets as `staticDir`, hit `GET /` and verify it returns HTML.

Run:
```bash
cd packages/server && bun test tests/http.test.ts
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve build issues in server + web"
```
