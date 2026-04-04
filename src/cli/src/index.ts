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
