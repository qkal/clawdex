import { loadConfig } from "@clawdex/config";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import type { ParsedArgs } from "../cli.js";

export async function runConfigCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "show";

  switch (sub) {
    case "show": {
      const config = await loadConfig({
        homeDir: homedir(),
        cwd: args.flags.cwd ?? process.cwd(),
      });
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case "path": {
      const globalPath = join(homedir(), ".clawdex", "config.toml");
      console.log(`Global: ${globalPath}`);
      console.log(`Project: ${join(process.cwd(), ".clawdex", "config.toml")}`);
      break;
    }

    case "edit": {
      const editor = process.env.EDITOR || (process.platform === "win32" ? "notepad" : "vi");
      const configPath = join(homedir(), ".clawdex", "config.toml");
      const child = spawn(editor, [configPath], { stdio: "inherit" });
      await new Promise<void>((resolve) => child.on("close", () => resolve()));
      break;
    }

    case "set": {
      if (!args.configKey || args.configValue === undefined) {
        console.error("Usage: clawdex config set <key> <value>");
        return;
      }
      console.log(`Set ${args.configKey} = ${args.configValue}`);
      console.log("Note: direct config editing coming soon. Use 'clawdex config edit' for now.");
      break;
    }

    default:
      console.error(`Unknown config subcommand: ${sub}`);
  }
}
