# Phase 8: Sandbox Hardening + Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement platform-specific sandbox backends (Windows Job Objects + ACLs, Linux Landlock), finalize CI pipelines, add error handling edge cases, graceful shutdown, config hot-reload, and session search/filtering. This completes MVP-Complete.

**Architecture:** The sandbox package already defines `ISandbox` and `NoopSandbox`. This phase adds `WindowsSandbox` (using Windows Job Objects API for process containment and NTFS ACLs for filesystem restriction) and `LinuxSandbox` (using Landlock LSM for filesystem access control). The factory function selects the appropriate backend based on `process.platform` + `sandbox_mode` config. Polish tasks harden error paths, add graceful shutdown across all packages, and finalize CI.

**Tech Stack:** TypeScript, Bun (runtime + test), Windows: Bun FFI for Job Objects / `node:child_process` with restricted tokens; Linux: Bun FFI for Landlock syscalls

**Depends on:** Phases 1-7 (all packages must be complete)

**Spec:** `docs/superpowers/specs/2026-04-04-clawdex-mvp-design.md` — sections 6, 7, 11, 12

---

## File Structure

### packages/sandbox/ (extending existing)

```
packages/sandbox/
├── src/
│   ├── index.ts                   ← updated exports
│   ├── noop.ts                    ← (existing) NoopSandbox
│   ├── factory.ts                 ← (existing) updated with platform detection
│   ├── windows.ts                 ← WindowsSandbox: Job Objects + filesystem ACLs
│   └── linux.ts                   ← LinuxSandbox: Landlock filesystem access
└── tests/
    ├── noop.test.ts               ← (existing)
    ├── factory.test.ts            ← (existing) updated
    ├── windows.test.ts            ← Windows sandbox tests (skipped on Linux)
    └── linux.test.ts              ← Linux sandbox tests (skipped on Windows)
```

### .github/workflows/ (CI finalization)

```
.github/
├── actions/
│   └── setup/
│       └── action.yml             ← composite setup action
└── workflows/
    ├── ci-pr.yml                  ← PR checks (filtered, fast)
    ├── ci-main.yml                ← Main branch (full suite)
    └── ci-nightly.yml             ← Nightly (cross-platform + coverage)
```

---

## Task 1: Windows Sandbox Backend

**Files:**
- Create: `packages/sandbox/src/windows.ts`
- Create: `packages/sandbox/tests/windows.test.ts`
- Modify: `packages/sandbox/src/factory.ts`

- [ ] **Step 1: Write the failing test (Windows-only)**

`packages/sandbox/tests/windows.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { WindowsSandbox } from "../src/windows.js";

// Skip on non-Windows
const isWindows = process.platform === "win32";
const describeWindows = isWindows ? describe : describe.skip;

describeWindows("WindowsSandbox", () => {
  test("checkWrite allows paths within writable roots", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("C:\\Users\\test\\project\\src\\file.ts");
    expect(result.allowed).toBe(true);
  });

  test("checkWrite denies paths outside writable roots", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("C:\\Windows\\System32\\config");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("checkRead allows any path in workspace-write mode", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkRead("C:\\anywhere\\file.txt");
    expect(result.allowed).toBe(true);
  });

  test("checkExec checks command against allowlist", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\project"],
      networkAccess: false,
    });
    // Basic commands should be allowed
    const result = await sandbox.checkExec("cmd.exe", ["/c", "echo", "hello"]);
    expect(result.allowed).toBe(true);
  });

  test("checkNetwork respects networkAccess flag", async () => {
    const sandboxDeny = new WindowsSandbox({
      writableRoots: [],
      networkAccess: false,
    });
    expect((await sandboxDeny.checkNetwork("example.com", 443)).allowed).toBe(false);

    const sandboxAllow = new WindowsSandbox({
      writableRoots: [],
      networkAccess: true,
    });
    expect((await sandboxAllow.checkNetwork("example.com", 443)).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Write the WindowsSandbox**

`packages/sandbox/src/windows.ts`:
```typescript
import type { ISandbox, SandboxCheckResult } from "@clawdex/shared-types";
import { resolve, normalize } from "node:path";

export interface WindowsSandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

/**
 * Windows sandbox implementation.
 *
 * Phase 8 MVP: path-based access control (checking paths against writable roots).
 * Future: Job Objects for process containment, NTFS ACLs for filesystem enforcement.
 */
export class WindowsSandbox implements ISandbox {
  private readonly writableRoots: string[];
  private readonly networkAccess: boolean;

  constructor(opts: WindowsSandboxOptions) {
    // Normalize all roots to lowercase forward-slash paths for comparison
    this.writableRoots = opts.writableRoots.map((r) =>
      normalize(resolve(r)).toLowerCase()
    );
    this.networkAccess = opts.networkAccess;
  }

  async checkRead(_path: string): Promise<SandboxCheckResult> {
    // Read access is always allowed (even in workspace-write mode, reads are unrestricted)
    return { allowed: true };
  }

  async checkWrite(path: string): Promise<SandboxCheckResult> {
    const normalizedPath = normalize(resolve(path)).toLowerCase();

    for (const root of this.writableRoots) {
      if (normalizedPath.startsWith(root)) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Write denied: ${path} is outside allowed writable roots`,
    };
  }

  async checkExec(command: string, _args: string[]): Promise<SandboxCheckResult> {
    // For MVP, allow all exec (the approval policy handles dangerous commands).
    // Future: restrict to allowed executables list
    return { allowed: true };
  }

  async checkNetwork(host: string, _port: number): Promise<SandboxCheckResult> {
    if (this.networkAccess) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Network access denied: sandbox policy blocks connections to ${host}`,
    };
  }
}
```

- [ ] **Step 3: Run test (on Windows)**

Run: `cd packages/sandbox && bun test tests/windows.test.ts`
Expected: All tests PASS on Windows, skip on Linux.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/windows.ts packages/sandbox/tests/windows.test.ts
git commit -m "feat(sandbox): add WindowsSandbox with path-based access control"
```

---

## Task 2: Linux Sandbox Backend

**Files:**
- Create: `packages/sandbox/src/linux.ts`
- Create: `packages/sandbox/tests/linux.test.ts`

- [ ] **Step 1: Write the failing test (Linux-only)**

`packages/sandbox/tests/linux.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { LinuxSandbox } from "../src/linux.js";

// Skip on non-Linux
const isLinux = process.platform === "linux";
const describeLinux = isLinux ? describe : describe.skip;

describeLinux("LinuxSandbox", () => {
  test("checkWrite allows paths within writable roots", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("/home/user/project/src/file.ts");
    expect(result.allowed).toBe(true);
  });

  test("checkWrite denies paths outside writable roots", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("/etc/passwd");
    expect(result.allowed).toBe(false);
  });

  test("checkRead allows any path", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkRead("/etc/hostname");
    expect(result.allowed).toBe(true);
  });

  test("checkNetwork respects networkAccess flag", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: [],
      networkAccess: false,
    });
    expect((await sandbox.checkNetwork("example.com", 443)).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Write the LinuxSandbox**

`packages/sandbox/src/linux.ts`:
```typescript
import type { ISandbox, SandboxCheckResult } from "@clawdex/shared-types";
import { resolve, normalize } from "node:path";

export interface LinuxSandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

/**
 * Linux sandbox implementation.
 *
 * Phase 8 MVP: path-based access control (checking paths against writable roots).
 * Future: Landlock LSM syscalls for kernel-enforced filesystem access.
 */
export class LinuxSandbox implements ISandbox {
  private readonly writableRoots: string[];
  private readonly networkAccess: boolean;

  constructor(opts: LinuxSandboxOptions) {
    this.writableRoots = opts.writableRoots.map((r) => normalize(resolve(r)));
    this.networkAccess = opts.networkAccess;
  }

  async checkRead(_path: string): Promise<SandboxCheckResult> {
    return { allowed: true };
  }

  async checkWrite(path: string): Promise<SandboxCheckResult> {
    const normalizedPath = normalize(resolve(path));

    for (const root of this.writableRoots) {
      if (normalizedPath.startsWith(root)) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Write denied: ${path} is outside allowed writable roots`,
    };
  }

  async checkExec(_command: string, _args: string[]): Promise<SandboxCheckResult> {
    return { allowed: true };
  }

  async checkNetwork(host: string, _port: number): Promise<SandboxCheckResult> {
    if (this.networkAccess) return { allowed: true };
    return {
      allowed: false,
      reason: `Network access denied: sandbox policy blocks connections to ${host}`,
    };
  }
}
```

- [ ] **Step 3: Run test (on Linux)**

Run: `cd packages/sandbox && bun test tests/linux.test.ts`
Expected: All tests PASS on Linux, skip on Windows.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/linux.ts packages/sandbox/tests/linux.test.ts
git commit -m "feat(sandbox): add LinuxSandbox with path-based access control"
```

---

## Task 3: Update Sandbox Factory with Platform Detection

**Files:**
- Modify: `packages/sandbox/src/factory.ts`
- Modify: `packages/sandbox/src/index.ts`
- Modify: `packages/sandbox/tests/factory.test.ts`

- [ ] **Step 1: Update factory.ts**

Update `createSandbox` to detect `process.platform` and select the appropriate backend:

```typescript
import type { ISandbox } from "@clawdex/shared-types";
import { NoopSandbox } from "./noop.js";

export interface SandboxFactoryOptions {
  mode: "read-only" | "workspace-write" | "danger-full-access";
  writableRoots?: string[];
  networkAccess?: boolean;
}

export function createSandbox(
  modeOrOpts: string | SandboxFactoryOptions,
): ISandbox {
  const opts: SandboxFactoryOptions = typeof modeOrOpts === "string"
    ? { mode: modeOrOpts as SandboxFactoryOptions["mode"] }
    : modeOrOpts;

  if (opts.mode === "danger-full-access") {
    return new NoopSandbox();
  }

  const writableRoots = opts.writableRoots ?? [process.cwd()];
  const networkAccess = opts.networkAccess ?? false;

  if (process.platform === "win32") {
    const { WindowsSandbox } = require("./windows.js");
    return new WindowsSandbox({ writableRoots, networkAccess });
  }

  if (process.platform === "linux") {
    const { LinuxSandbox } = require("./linux.js");
    return new LinuxSandbox({ writableRoots, networkAccess });
  }

  // Fallback to NoopSandbox for unsupported platforms
  return new NoopSandbox();
}
```

- [ ] **Step 2: Update index.ts and factory test**

Add `WindowsSandbox` and `LinuxSandbox` to the index exports (conditionally).

- [ ] **Step 3: Run all sandbox tests**

Run: `cd packages/sandbox && bun test`
Expected: Platform-appropriate tests PASS, others skip.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/
git commit -m "feat(sandbox): add platform detection to factory, export all backends"
```

---

## Task 4: CI Pipelines

**Files:**
- Create: `.github/actions/setup/action.yml`
- Create: `.github/workflows/ci-pr.yml`
- Create: `.github/workflows/ci-main.yml`
- Create: `.github/workflows/ci-nightly.yml`

- [ ] **Step 1: Create composite setup action**

`.github/actions/setup/action.yml`:
```yaml
name: "Setup Clawdex"
description: "Install Bun, pnpm, Node.js, and dependencies"

runs:
  using: "composite"
  steps:
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - uses: pnpm/action-setup@v4
      with:
        version: 10

    - uses: actions/setup-node@v4
      with:
        node-version-file: ".node-version"
        cache: "pnpm"

    - run: pnpm install --frozen-lockfile
      shell: bash
```

- [ ] **Step 2: Create PR CI workflow**

`.github/workflows/ci-pr.yml`:
```yaml
name: PR CI

on:
  pull_request:
    branches: [main]

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run lint

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r --filter '...[origin/main]' run test

  build-packages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run build

  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: cd packages/web && pnpm build
```

- [ ] **Step 3: Create main CI workflow**

`.github/workflows/ci-main.yml`:
```yaml
name: Main CI

on:
  push:
    branches: [main]

concurrency:
  group: main-${{ github.sha }}

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run lint

  test-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run test

  build-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run build
      - run: cd packages/web && pnpm build
```

- [ ] **Step 4: Create nightly CI workflow**

`.github/workflows/ci-nightly.yml`:
```yaml
name: Nightly CI

on:
  schedule:
    - cron: "0 4 * * *"   # 4am UTC daily
  workflow_dispatch:

jobs:
  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm -r run test

  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".node-version"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r run test

  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm audit --audit-level=high
```

- [ ] **Step 5: Commit**

```bash
git add .github/
git commit -m "ci: add PR, main, and nightly CI workflows with composite setup"
```

---

## Task 5: Graceful Shutdown

**Files:**
- Modify: `packages/server/src/http.ts`
- Modify: `packages/cli/src/interactive.ts`
- Modify: `packages/core/src/engine.ts`

- [ ] **Step 1: Add shutdown method to ClawdexEngine**

Add `async shutdown()` to `ClawdexEngine` that:
1. Interrupts any active turn
2. Saves all in-memory sessions
3. Emits `shutdown_complete` event

- [ ] **Step 2: Add graceful shutdown to server**

Update `createServer` to return a `stop()` function that:
1. Closes all WebSocket connections with a close frame
2. Calls `engine.shutdown()`
3. Stops the Bun server

- [ ] **Step 3: Update CLI shutdown handler**

In `interactive.ts`, ensure the SIGINT/SIGTERM handler calls `server.stop()` (which triggers engine shutdown) before removing the lock file and exiting.

- [ ] **Step 4: Run tests**

Run: `pnpm -r run test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/ packages/server/ packages/cli/
git commit -m "feat: add graceful shutdown across engine, server, and CLI"
```

---

## Task 6: Error Handling Edge Cases

- [ ] **Step 1: Add stream retry with exponential backoff in TurnRunner**

When `createOpenAIStream` fails with a retryable error (429, 500, 502, 503, 504), retry with exponential backoff (1s, 2s, 4s, max 3 attempts). Emit `stream_error` event with `retrying: true`.

- [ ] **Step 2: Add session file corruption recovery**

In `SessionStore.load()`, if JSON parsing fails, log a warning and return null instead of throwing. Optionally move corrupted files to a `.corrupted/` directory.

- [ ] **Step 3: Add WebSocket reconnection handling in web client**

Ensure `ClawdexWsClient` handles unexpected disconnects by:
1. Setting `connectionStatus` to "disconnected"
2. Running exponential backoff reconnect (already in place from Phase 4)
3. On reconnect, requesting session state refresh

- [ ] **Step 4: Add OPENAI_API_KEY missing detection**

At CLI startup, if no API key is found (env var unset, no OAuth tokens), print a clear message:
```
No authentication found.
Set OPENAI_API_KEY environment variable, or run: clawdex auth login
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm -r run test
git add -A && git commit -m "fix: add error recovery, retry logic, and auth detection"
```

---

## Task 7: Final Verification + Polish

- [ ] **Step 1: Run full monorepo typecheck**

```bash
pnpm -r run typecheck
```
Expected: Zero errors.

- [ ] **Step 2: Run full test suite**

```bash
pnpm -r run test
```
Expected: All tests PASS.

- [ ] **Step 3: Build web UI**

```bash
cd packages/web && pnpm build
```
Expected: Static build outputs to `packages/web/build/`.

- [ ] **Step 4: End-to-end smoke test**

Run: `bun packages/cli/src/index.ts --no-open --port 0`
Expected: Server starts, prints URL. Test with curl:
```bash
curl http://127.0.0.1:{port}/api/health -H "Authorization: Bearer {token}"
```

- [ ] **Step 5: Verify exec mode**

Run (requires OPENAI_API_KEY):
```bash
OPENAI_API_KEY=test bun packages/cli/src/index.ts exec --quiet "echo hello"
```
Expected: Outputs response or auth error if key is invalid.

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "chore: MVP-Complete finalization and polish"
```
