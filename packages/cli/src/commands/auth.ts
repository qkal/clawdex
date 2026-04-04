import { createAuthProvider } from "@clawdex/auth";
import { loadConfig } from "@clawdex/config";
import { homedir } from "node:os";
import type { ParsedArgs } from "../cli.js";

export async function runAuthCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "status";
  const config = await loadConfig({
    homeDir: homedir(),
    cwd: args.flags.cwd ?? process.cwd(),
  });

  switch (sub) {
    case "status": {
      const provider = createAuthProvider("api_key", config.auth.api_key_env);
      const status = await provider.getStatus();
      if (status.authenticated) {
        console.log(`Authenticated via ${status.method}`);
        if (status.user) console.log(`User: ${status.user}`);
      } else {
        console.log("Not authenticated");
        console.log("Set OPENAI_API_KEY or run: clawdex auth login");
      }
      break;
    }

    case "login": {
      console.log("OAuth login not yet implemented. Set OPENAI_API_KEY instead.");
      break;
    }

    case "logout": {
      const provider = createAuthProvider("api_key", config.auth.api_key_env);
      await provider.logout();
      console.log("Logged out.");
      break;
    }

    default:
      console.error(`Unknown auth subcommand: ${sub}`);
  }
}
