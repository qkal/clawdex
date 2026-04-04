import type { ParsedArgs } from "../cli.js";

export async function runMcpCommand(args: ParsedArgs): Promise<void> {
  const sub = args.subcommand ?? "list";

  switch (sub) {
    case "list":
      console.log("MCP server management coming in Phase 7.");
      console.log("Configure MCP servers in ~/.clawdex/config.toml under [mcp_servers]");
      break;

    case "add":
      console.log("MCP server management coming in Phase 7.");
      break;

    default:
      console.error(`Unknown mcp subcommand: ${sub}`);
  }
}
