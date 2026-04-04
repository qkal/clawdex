import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "@clawdex/config";
import { createAuthProvider } from "@clawdex/auth";
import { createSandbox } from "@clawdex/sandbox";
import { ToolRegistry } from "@clawdex/tools";
import { ClawdexEngine } from "@clawdex/core";
import type { EventMsg } from "@clawdex/shared-types";
import { streamEventToStdout, formatExecOutput } from "./output.js";
import type { ParsedArgs } from "./cli.js";

export async function runExec(args: ParsedArgs): Promise<number> {
  if (!args.execPrompt) {
    console.error("Error: exec requires a prompt. Usage: clawdex exec \"prompt\"");
    return 1;
  }

  // Build CLI overrides from flags
  const cliOverrides: Record<string, unknown> = {};
  if (args.flags.model) cliOverrides.model = args.flags.model;
  if (args.flags.sandbox) cliOverrides.sandbox_mode = args.flags.sandbox;
  if (args.flags.approvalPolicy) cliOverrides.approval_policy = args.flags.approvalPolicy;
  else cliOverrides.approval_policy = "never";

  const config = await loadConfig({
    homeDir: homedir(),
    cwd: args.flags.cwd ?? process.cwd(),
    cliOverrides,
  });

  const authProvider = createAuthProvider("api_key", config.auth.api_key_env);
  const sandbox = createSandbox(config.sandbox_mode);
  const toolRegistry = ToolRegistry.withBuiltins();
  const engine = new ClawdexEngine({
    config,
    authProvider,
    sandbox,
    toolRegistry,
    sessionsDir: args.execEphemeral
      ? undefined
      : join(homedir(), ".clawdex", "sessions"),
  });

  const format = args.execFormat ?? "text";
  const collectedEvents: EventMsg[] = [];

  // Listen for events
  engine.on("event", (event) => {
    collectedEvents.push(event);
    streamEventToStdout(event, format);
  });

  // Create session and run turn
  const session = await engine.createSession({
    workingDir: args.flags.cwd ?? process.cwd(),
  });

  let exitCode = 0;

  try {
    await engine.runTurn(session.id, {
      prompt: args.execPrompt,
      model: args.flags.model,
    });
  } catch (err) {
    console.error(`Error: ${err}`);
    exitCode = 1;
  }

  // For quiet mode, output the final result at the end
  if (format === "quiet") {
    const output = formatExecOutput(collectedEvents, "quiet");
    if (output) {
      process.stdout.write(output + "\n");
    }
  }

  // Check if any errors occurred
  const hadError = collectedEvents.some(
    (e) => e.type === "turn_aborted" && (e as any).reason === "error",
  );
  if (hadError) exitCode = 1;

  return exitCode;
}
