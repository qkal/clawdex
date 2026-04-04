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

  // Build CLI overrides from flags
  const cliOverrides: Record<string, unknown> = {};
  if (args.flags.model) cliOverrides.model = args.flags.model;
  if (args.flags.sandbox) cliOverrides.sandbox_mode = args.flags.sandbox;
  if (args.flags.port) cliOverrides.server = { port: args.flags.port };

  // Load config with CLI flag overrides
  const config = await loadConfig({
    homeDir: homedir(),
    cwd: args.flags.cwd ?? process.cwd(),
    cliOverrides,
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
  const authProvider = createAuthProvider("api_key", config.auth.api_key_env);
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
  const host = config.server.host ?? "127.0.0.1";
  const port = config.server.port ?? 3141;
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
    port: server.port ?? port,
    token,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
  });

  const url = `http://${host}:${server.port}/?token=${token}`;
  console.log(`Clawdex server running at ${url}`);

  if (!args.flags.noOpen && config.server.open_browser !== false) {
    openBrowser(url);
  }

  // Handle graceful shutdown: flush engine state before stopping the server.
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down...");
    await engine.shutdown();
    server.stop();
    await removeLockFile(lockPath);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
