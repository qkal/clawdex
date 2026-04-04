# Phase 6: Auth + Memories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `auth` package with full ChatGPT OAuth flow (browser redirect, token storage, refresh) and build the `memories` package for file-based cross-session memory persistence with single-pass consolidation.

**Architecture:** Auth adds `OAuthAuthProvider` alongside the existing `ApiKeyAuthProvider`. OAuth uses the browser redirect flow: CLI starts a temporary localhost callback server, opens the ChatGPT auth URL, receives the code, exchanges it for tokens, and persists them to `~/.clawdex/auth.json`. Memories is a simplified version of Codex's two-phase DB system — it reads/writes Markdown memory files to `~/.clawdex/memories/`, uses a single LLM consolidation pass (no sub-agent, no state DB), and injects memories into the system prompt.

**Tech Stack:** TypeScript, Bun (runtime + test), native `fetch` for OAuth token exchange, `@clawdex/shared-types`, `@clawdex/testkit`

**Depends on:** Phases 1-5 (MVP-Alpha must be complete)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` — sections 3, 8

---

## File Structure

### packages/auth/ (extending existing)

```
packages/auth/
├── src/
│   ├── index.ts                   ← updated exports
│   ├── api-key.ts                 ← (existing) ApiKeyAuthProvider
│   ├── oauth.ts                   ← OAuthAuthProvider: full browser redirect flow
│   ├── token-store.ts             ← Read/write auth.json, token refresh logic
│   └── callback-server.ts         ← Temporary localhost server for OAuth callback
└── tests/
    ├── api-key.test.ts            ← (existing)
    ├── oauth.test.ts              ← OAuth flow tests (mocked)
    ├── token-store.test.ts        ← Token persistence tests
    └── callback-server.test.ts    ← Callback server tests
```

### packages/memories/

```
packages/memories/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← public exports
│   ├── store.ts                   ← MemoryStore: read/write/list memory files
│   ├── consolidate.ts             ← Single-pass LLM consolidation
│   ├── inject.ts                  ← Build memory context string for system prompt
│   └── types.ts                   ← MemoryEntry, ConsolidationResult types
└── tests/
    ├── store.test.ts              ← File-based memory CRUD
    ├── consolidate.test.ts        ← Consolidation with mock LLM
    └── inject.test.ts             ← System prompt injection
```

---

## Task 1: Token Store — Persistent Auth Tokens

**Files:**
- Create: `packages/auth/src/token-store.ts`
- Create: `packages/auth/tests/token-store.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/auth/tests/token-store.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TokenStore } from "../src/token-store.js";

describe("TokenStore", () => {
  let dir: string;
  let store: TokenStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-auth-"));
    store = new TokenStore(join(dir, "auth.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save and load round-trips tokens", async () => {
    await store.save({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: "2026-12-31T23:59:59Z",
      user: "testuser",
    });
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe("access-123");
    expect(loaded!.refreshToken).toBe("refresh-456");
    expect(loaded!.user).toBe("testuser");
  });

  test("load returns null when file does not exist", async () => {
    const loaded = await store.load();
    expect(loaded).toBeNull();
  });

  test("clear removes stored tokens", async () => {
    await store.save({
      accessToken: "a",
      refreshToken: "b",
      expiresAt: "2026-12-31T23:59:59Z",
    });
    await store.clear();
    const loaded = await store.load();
    expect(loaded).toBeNull();
  });

  test("isExpired returns true for past dates", () => {
    expect(store.isExpired("2020-01-01T00:00:00Z")).toBe(true);
  });

  test("isExpired returns false for future dates", () => {
    expect(store.isExpired("2030-01-01T00:00:00Z")).toBe(false);
  });

  test("isExpired returns false for undefined", () => {
    expect(store.isExpired(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Write the TokenStore**

`packages/auth/src/token-store.ts`:
```typescript
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: string;
}

export class TokenStore {
  constructor(private readonly filePath: string) {}

  async save(tokens: StoredTokens): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(tokens, null, 2), {
      encoding: "utf-8",
      mode: 0o600, // restrictive permissions
    });
  }

  async load(): Promise<StoredTokens | null> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as StoredTokens;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch {
      // Already gone
    }
  }

  /** Check if a token expiry date is in the past. */
  isExpired(expiresAt: string | undefined): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }
}
```

- [ ] **Step 3: Run test**

Run: `cd packages/auth && bun test tests/token-store.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/token-store.ts packages/auth/tests/token-store.test.ts
git commit -m "feat(auth): add TokenStore for persistent OAuth token storage"
```

---

## Task 2: OAuth Callback Server

**Files:**
- Create: `packages/auth/src/callback-server.ts`
- Create: `packages/auth/tests/callback-server.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/auth/tests/callback-server.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { startCallbackServer } from "../src/callback-server.js";

describe("OAuth callback server", () => {
  test("starts on a random port and returns the port", async () => {
    const { port, stop, codePromise } = await startCallbackServer();
    expect(port).toBeGreaterThan(0);

    // Simulate OAuth redirect with code
    const url = `http://127.0.0.1:${port}/callback?code=test-auth-code&state=test-state`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);

    const code = await codePromise;
    expect(code).toBe("test-auth-code");

    stop();
  });

  test("returns error page for missing code", async () => {
    const { port, stop, codePromise } = await startCallbackServer();

    const url = `http://127.0.0.1:${port}/callback`;
    const res = await fetch(url);
    expect(res.status).toBe(400);

    stop();
  });
});
```

- [ ] **Step 2: Write the callback server**

`packages/auth/src/callback-server.ts`:
```typescript
import type { Server } from "bun";

export interface CallbackServerResult {
  port: number;
  stop: () => void;
  /** Resolves with the authorization code when the callback is received. */
  codePromise: Promise<string>;
}

/**
 * Start a temporary localhost HTTP server to receive the OAuth callback.
 * It listens on a random port and waits for a single /callback?code=... request.
 */
export async function startCallbackServer(): Promise<CallbackServerResult> {
  let resolveCode: (code: string) => void;
  const codePromise = new Promise<string>((resolve) => {
    resolveCode = resolve;
  });

  const server: Server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0, // random port
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response(
            "<html><body><h1>Error</h1><p>Missing authorization code.</p></body></html>",
            { status: 400, headers: { "Content-Type": "text/html" } },
          );
        }

        resolveCode!(code);
        return new Response(
          "<html><body><h1>Login successful!</h1><p>You can close this tab and return to Clawdex.</p></body></html>",
          { headers: { "Content-Type": "text/html" } },
        );
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    port: server.port,
    stop: () => server.stop(),
    codePromise,
  };
}
```

- [ ] **Step 3: Run test**

Run: `cd packages/auth && bun test tests/callback-server.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/callback-server.ts packages/auth/tests/callback-server.test.ts
git commit -m "feat(auth): add temporary OAuth callback server"
```

---

## Task 3: OAuthAuthProvider — Full Flow

**Files:**
- Modify: `packages/auth/src/oauth.ts`
- Create: `packages/auth/tests/oauth.test.ts`
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/auth/tests/oauth.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OAuthAuthProvider } from "../src/oauth.js";
import { TokenStore } from "../src/token-store.js";

describe("OAuthAuthProvider", () => {
  let dir: string;
  let tokenStore: TokenStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-oauth-"));
    tokenStore = new TokenStore(join(dir, "auth.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("getStatus returns not authenticated when no tokens stored", async () => {
    const provider = new OAuthAuthProvider({ tokenStore });
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });

  test("getStatus returns authenticated when valid tokens exist", async () => {
    await tokenStore.save({
      accessToken: "valid-token",
      expiresAt: "2030-01-01T00:00:00Z",
      user: "testuser",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(true);
    expect(status.method).toBe("oauth");
    expect(status.user).toBe("testuser");
  });

  test("getToken returns stored access token", async () => {
    await tokenStore.save({
      accessToken: "valid-token",
      expiresAt: "2030-01-01T00:00:00Z",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    const result = await provider.getToken();
    expect(result.token).toBe("valid-token");
  });

  test("getToken returns empty when no tokens and no refresh possible", async () => {
    const provider = new OAuthAuthProvider({ tokenStore });
    const result = await provider.getToken();
    expect(result.token).toBe("");
  });

  test("logout clears stored tokens", async () => {
    await tokenStore.save({
      accessToken: "token",
      expiresAt: "2030-01-01T00:00:00Z",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    await provider.logout();
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });
});
```

- [ ] **Step 2: Write the OAuthAuthProvider**

`packages/auth/src/oauth.ts`:
```typescript
import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";
import { TokenStore, type StoredTokens } from "./token-store.js";
import { startCallbackServer } from "./callback-server.js";

export interface OAuthConfig {
  tokenStore: TokenStore;
  /** ChatGPT OAuth authorize URL. */
  authorizeUrl?: string;
  /** ChatGPT OAuth token exchange URL. */
  tokenUrl?: string;
  /** OAuth client ID. */
  clientId?: string;
  /** Function to open a URL in the browser (injected for testing). */
  openBrowser?: (url: string) => void;
  /** Function to perform the token exchange HTTP request (injected for testing). */
  fetchFn?: typeof fetch;
}

const DEFAULT_AUTHORIZE_URL = "https://auth.openai.com/authorize";
const DEFAULT_TOKEN_URL = "https://auth.openai.com/oauth/token";
const DEFAULT_CLIENT_ID = "app-clawdex";

export class OAuthAuthProvider implements IAuthProvider {
  private readonly tokenStore: TokenStore;
  private readonly authorizeUrl: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly openBrowser: ((url: string) => void) | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(opts: OAuthConfig) {
    this.tokenStore = opts.tokenStore;
    this.authorizeUrl = opts.authorizeUrl ?? DEFAULT_AUTHORIZE_URL;
    this.tokenUrl = opts.tokenUrl ?? DEFAULT_TOKEN_URL;
    this.clientId = opts.clientId ?? DEFAULT_CLIENT_ID;
    this.openBrowser = opts.openBrowser;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async getToken(): Promise<AuthToken> {
    const stored = await this.tokenStore.load();
    if (!stored) {
      return { token: "", expiresAt: null };
    }

    // Check if token is expired and try refresh
    if (this.tokenStore.isExpired(stored.expiresAt) && stored.refreshToken) {
      const refreshed = await this.refreshToken(stored.refreshToken);
      if (refreshed) {
        return { token: refreshed.accessToken, expiresAt: refreshed.expiresAt ?? null };
      }
      return { token: "", expiresAt: null };
    }

    return { token: stored.accessToken, expiresAt: stored.expiresAt ?? null };
  }

  async getStatus(): Promise<AuthStatus> {
    const stored = await this.tokenStore.load();
    if (!stored) {
      return { authenticated: false };
    }

    if (this.tokenStore.isExpired(stored.expiresAt) && !stored.refreshToken) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      method: "oauth",
      user: stored.user,
    };
  }

  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  /**
   * Initiate the full OAuth browser redirect flow.
   * 1. Start callback server on random port
   * 2. Open browser to authorize URL
   * 3. Wait for callback with auth code
   * 4. Exchange code for tokens
   * 5. Store tokens
   */
  async login(): Promise<boolean> {
    const { port, stop, codePromise } = await startCallbackServer();
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const authUrl = new URL(this.authorizeUrl);
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openai.public");

    // Open browser
    if (this.openBrowser) {
      this.openBrowser(authUrl.toString());
    }

    try {
      const code = await codePromise;

      // Exchange code for tokens
      const response = await this.fetchFn(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: this.clientId,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user?: string;
      };

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;

      await this.tokenStore.save({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        user: data.user,
      });

      return true;
    } finally {
      stop();
    }
  }

  private async refreshToken(refreshToken: string): Promise<StoredTokens | null> {
    try {
      const response = await this.fetchFn(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: this.clientId,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user?: string;
      };

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;

      const tokens: StoredTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt,
        user: data.user,
      };

      await this.tokenStore.save(tokens);
      return tokens;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 3: Update auth index.ts**

`packages/auth/src/index.ts`:
```typescript
export { ApiKeyAuthProvider } from "./api-key.js";
export { OAuthAuthProvider } from "./oauth.js";
export type { OAuthConfig } from "./oauth.js";
export { TokenStore } from "./token-store.js";
export type { StoredTokens } from "./token-store.js";
export { startCallbackServer } from "./callback-server.js";
export { createAuthProvider } from "./api-key.js"; // factory re-export
```

- [ ] **Step 4: Run tests**

Run: `cd packages/auth && bun test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): add full OAuthAuthProvider with browser redirect, token refresh"
```

---

## Task 4: Memories Package — MemoryStore

**Files:**
- Create: `packages/memories/package.json`
- Create: `packages/memories/tsconfig.json`
- Create: `packages/memories/src/types.ts`
- Create: `packages/memories/src/store.ts`
- Create: `packages/memories/tests/store.test.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Create package scaffolding**

`packages/memories/package.json`:
```json
{
  "name": "@clawdex/memories",
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
    "@clawdex/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@clawdex/testkit": "workspace:*",
    "typescript": "^5.8.3"
  }
}
```

`packages/memories/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared-types" }
  ]
}
```

`packages/memories/src/types.ts`:
```typescript
export interface MemoryEntry {
  id: string;
  content: string;
  source: string;        // session id or "consolidation"
  createdAt: string;
  tags?: string[];
}

export interface ConsolidationResult {
  summary: string;
  entriesProcessed: number;
  timestamp: string;
}
```

- [ ] **Step 2: Write the failing test**

`packages/memories/tests/store.test.ts`:
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/store.js";

describe("MemoryStore", () => {
  let dir: string;
  let store: MemoryStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-memories-"));
    store = new MemoryStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("add and list memories", async () => {
    await store.add({
      content: "User prefers TypeScript",
      source: "session-abc",
    });
    await store.add({
      content: "Project uses pnpm workspaces",
      source: "session-abc",
    });

    const memories = await store.list();
    expect(memories).toHaveLength(2);
    expect(memories[0].content).toContain("TypeScript");
  });

  test("get returns a specific memory by id", async () => {
    const entry = await store.add({
      content: "Important fact",
      source: "session-1",
    });
    const found = await store.get(entry.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe("Important fact");
  });

  test("get returns null for unknown id", async () => {
    expect(await store.get("nonexistent")).toBeNull();
  });

  test("remove deletes a memory", async () => {
    const entry = await store.add({
      content: "Temporary",
      source: "session-1",
    });
    await store.remove(entry.id);
    expect(await store.get(entry.id)).toBeNull();
  });

  test("clear removes all memories", async () => {
    await store.add({ content: "A", source: "s1" });
    await store.add({ content: "B", source: "s1" });
    await store.clear();
    const memories = await store.list();
    expect(memories).toHaveLength(0);
  });

  test("getSummary returns consolidated summary file", async () => {
    await store.writeSummary("This is the consolidated summary.");
    const summary = await store.getSummary();
    expect(summary).toBe("This is the consolidated summary.");
  });

  test("getSummary returns null when no summary exists", async () => {
    expect(await store.getSummary()).toBeNull();
  });
});
```

- [ ] **Step 3: Write the MemoryStore**

`packages/memories/src/store.ts`:
```typescript
import { mkdir, readdir, readFile, writeFile, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { MemoryEntry } from "./types.js";

export class MemoryStore {
  private readonly memoriesDir: string;
  private readonly summaryPath: string;

  constructor(baseDir: string) {
    this.memoriesDir = join(baseDir, "entries");
    this.summaryPath = join(baseDir, "memory_summary.md");
  }

  private entryPath(id: string): string {
    return join(this.memoriesDir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.memoriesDir, { recursive: true });
  }

  async add(opts: { content: string; source: string; tags?: string[] }): Promise<MemoryEntry> {
    await this.ensureDir();
    const entry: MemoryEntry = {
      id: randomUUID().slice(0, 12),
      content: opts.content,
      source: opts.source,
      createdAt: new Date().toISOString(),
      tags: opts.tags,
    };
    await writeFile(this.entryPath(entry.id), JSON.stringify(entry, null, 2), "utf-8");
    return entry;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    try {
      const raw = await readFile(this.entryPath(id), "utf-8");
      return JSON.parse(raw) as MemoryEntry;
    } catch {
      return null;
    }
  }

  async list(): Promise<MemoryEntry[]> {
    await this.ensureDir();
    const files = await readdir(this.memoriesDir);
    const entries: MemoryEntry[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.memoriesDir, file), "utf-8");
        entries.push(JSON.parse(raw));
      } catch {
        // Skip corrupted entries
      }
    }

    return entries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async remove(id: string): Promise<void> {
    try {
      await unlink(this.entryPath(id));
    } catch {
      // Already removed
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.memoriesDir, { recursive: true, force: true });
    } catch {
      // Already empty
    }
  }

  async writeSummary(summary: string): Promise<void> {
    await mkdir(join(this.summaryPath, ".."), { recursive: true });
    await writeFile(this.summaryPath, summary, "utf-8");
  }

  async getSummary(): Promise<string | null> {
    try {
      return await readFile(this.summaryPath, "utf-8");
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run test**

Run: `cd packages/memories && bun test tests/store.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/memories/ tsconfig.build.json
git commit -m "feat(memories): add MemoryStore with file-based CRUD"
```

---

## Task 5: Memory Consolidation + System Prompt Injection

**Files:**
- Create: `packages/memories/src/consolidate.ts`
- Create: `packages/memories/src/inject.ts`
- Create: `packages/memories/src/index.ts`
- Create: `packages/memories/tests/consolidate.test.ts`
- Create: `packages/memories/tests/inject.test.ts`

- [ ] **Step 1: Write consolidation test**

`packages/memories/tests/consolidate.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { buildConsolidationPrompt, parseConsolidationResult } from "../src/consolidate.js";
import type { MemoryEntry } from "../src/types.js";

describe("buildConsolidationPrompt", () => {
  test("includes all memory entries", () => {
    const entries: MemoryEntry[] = [
      { id: "1", content: "User prefers TypeScript", source: "s1", createdAt: "2026-01-01T00:00:00Z" },
      { id: "2", content: "Project uses monorepo", source: "s2", createdAt: "2026-01-02T00:00:00Z" },
    ];
    const prompt = buildConsolidationPrompt(entries);
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("monorepo");
    expect(prompt).toContain("consolidate");
  });
});

describe("parseConsolidationResult", () => {
  test("extracts summary from LLM response", () => {
    const response = "The user prefers TypeScript and uses a monorepo with pnpm workspaces.";
    const result = parseConsolidationResult(response, 2);
    expect(result.summary).toBe(response);
    expect(result.entriesProcessed).toBe(2);
  });
});
```

- [ ] **Step 2: Write consolidation module**

`packages/memories/src/consolidate.ts`:
```typescript
import type { MemoryEntry, ConsolidationResult } from "./types.js";

/** Build the prompt for the LLM to consolidate memory entries. */
export function buildConsolidationPrompt(entries: MemoryEntry[]): string {
  const formattedEntries = entries
    .map((e, i) => `${i + 1}. [${e.createdAt}] ${e.content}`)
    .join("\n");

  return [
    "You are a memory consolidation assistant. Review the following memories",
    "collected across multiple sessions and consolidate them into a concise summary.",
    "Remove duplicates, merge related facts, and organize by topic.",
    "Keep the most important and actionable information.",
    "",
    "Raw memories:",
    formattedEntries || "(no memories)",
    "",
    "Produce a consolidated summary (Markdown format, under 1000 words):",
  ].join("\n");
}

/** Parse the LLM's consolidation response. */
export function parseConsolidationResult(
  response: string,
  entriesProcessed: number,
): ConsolidationResult {
  return {
    summary: response.trim(),
    entriesProcessed,
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 3: Write injection test**

`packages/memories/tests/inject.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { buildMemoryContext } from "../src/inject.js";

describe("buildMemoryContext", () => {
  test("includes summary when available", () => {
    const ctx = buildMemoryContext("User works with TypeScript monorepos.");
    expect(ctx).toContain("TypeScript monorepos");
    expect(ctx).toContain("Memory");
  });

  test("returns empty string when no summary", () => {
    expect(buildMemoryContext(null)).toBe("");
    expect(buildMemoryContext("")).toBe("");
  });
});
```

- [ ] **Step 4: Write injection module**

`packages/memories/src/inject.ts`:
```typescript
/**
 * Build a memory context block to inject into the system prompt.
 * Returns empty string if no memories are available.
 */
export function buildMemoryContext(summary: string | null): string {
  if (!summary) return "";
  return [
    "## Memory (from previous sessions)",
    "",
    summary,
  ].join("\n");
}
```

- [ ] **Step 5: Write index.ts**

`packages/memories/src/index.ts`:
```typescript
export { MemoryStore } from "./store.js";
export { buildConsolidationPrompt, parseConsolidationResult } from "./consolidate.js";
export { buildMemoryContext } from "./inject.js";
export type { MemoryEntry, ConsolidationResult } from "./types.js";
```

- [ ] **Step 6: Run all memories tests**

Run: `cd packages/memories && bun test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/memories/
git commit -m "feat(memories): add consolidation and system prompt injection"
```

---

## Task 6: Integration — Wire Auth + Memories into Core

- [ ] **Step 1: Update core's EngineOptions to accept memories**

Add `memoriesDir?: string` to `EngineOptions` in `packages/core/src/types.ts`.

- [ ] **Step 2: Update ClawdexEngine to load and inject memories**

In `packages/core/src/engine.ts`, import `MemoryStore` and `buildMemoryContext` from `@clawdex/memories`. In the `runTurn` method, load the memory summary and pass it as `additionalContext` to `buildSystemPrompt`.

- [ ] **Step 3: Update CLI to pass OAuth as an option**

In `packages/cli/src/interactive.ts` and `exec.ts`, update `createAuthProvider` to check config and return either `ApiKeyAuthProvider` or `OAuthAuthProvider`.

- [ ] **Step 4: Run full test suite**

Run: `pnpm -r run test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/ packages/cli/
git commit -m "feat: wire auth + memories into core engine and CLI"
```
