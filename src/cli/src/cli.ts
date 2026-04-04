export interface ParsedArgs {
  command: "interactive" | "exec" | "config" | "auth" | "sessions" | "mcp" | "version" | "help";
  subcommand?: string;
  execPrompt?: string;
  execFormat?: "text" | "json" | "quiet";
  execEphemeral?: boolean;
  configKey?: string;
  configValue?: string;
  sessionId?: string;
  flags: {
    model?: string;
    sandbox?: string;
    port?: number;
    noOpen?: boolean;
    cwd?: string;
    approvalPolicy?: string;
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: ParsedArgs["flags"] = {};
  const positional: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--version") return { command: "version", flags };
    if (arg === "--help" || arg === "-h") return { command: "help", flags };

    if (arg === "--model" && i + 1 < argv.length) {
      flags.model = argv[++i];
    } else if (arg === "--sandbox" && i + 1 < argv.length) {
      flags.sandbox = argv[++i];
    } else if (arg === "--port" && i + 1 < argv.length) {
      flags.port = parseInt(argv[++i], 10);
    } else if (arg === "--no-open") {
      flags.noOpen = true;
    } else if (arg === "--cwd" && i + 1 < argv.length) {
      flags.cwd = argv[++i];
    } else if (arg === "--approval-policy" && i + 1 < argv.length) {
      flags.approvalPolicy = argv[++i];
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
    i++;
  }

  if (positional.length === 0) {
    return { command: "interactive", flags };
  }

  const cmd = positional[0];

  if (cmd === "exec") {
    let execFormat: "text" | "json" | "quiet" = "text";
    let execEphemeral = false;

    // Re-scan argv for exec-specific flags
    for (let j = 0; j < argv.length; j++) {
      if (argv[j] === "--json") execFormat = "json";
      if (argv[j] === "--quiet") execFormat = "quiet";
      if (argv[j] === "--ephemeral") execEphemeral = true;
    }

    // Collect non-flag args after "exec" as the prompt
    const execIdx = argv.indexOf("exec");
    const execArgs = argv.slice(execIdx + 1).filter((a) => !a.startsWith("--"));
    const prompt = execArgs.join(" ");

    return {
      command: "exec",
      execPrompt: prompt || undefined,
      execFormat,
      execEphemeral,
      flags,
    };
  }

  if (cmd === "config") {
    const sub = positional[1] ?? "show";
    return {
      command: "config",
      subcommand: sub,
      configKey: positional[2],
      configValue: positional[3],
      flags,
    };
  }

  if (cmd === "auth") {
    return { command: "auth", subcommand: positional[1] ?? "status", flags };
  }

  if (cmd === "sessions") {
    return {
      command: "sessions",
      subcommand: positional[1] ?? "list",
      sessionId: positional[2],
      flags,
    };
  }

  if (cmd === "mcp") {
    return { command: "mcp", subcommand: positional[1] ?? "list", flags };
  }

  return { command: "interactive", flags };
}
