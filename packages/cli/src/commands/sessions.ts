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
