import { describe, test, expect } from "bun:test";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  test("no args → interactive mode", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("interactive");
  });

  test("exec 'prompt' → exec mode with prompt", () => {
    const result = parseArgs(["exec", "write hello world"]);
    expect(result.command).toBe("exec");
    expect(result.execPrompt).toBe("write hello world");
  });

  test("exec --json → exec with json output", () => {
    const result = parseArgs(["exec", "--json", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execFormat).toBe("json");
  });

  test("exec --quiet → exec with quiet output", () => {
    const result = parseArgs(["exec", "--quiet", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execFormat).toBe("quiet");
  });

  test("exec --ephemeral → no session persistence", () => {
    const result = parseArgs(["exec", "--ephemeral", "do something"]);
    expect(result.command).toBe("exec");
    expect(result.execEphemeral).toBe(true);
  });

  test("config → config subcommand", () => {
    const result = parseArgs(["config"]);
    expect(result.command).toBe("config");
    expect(result.subcommand).toBe("show");
  });

  test("config set key value → config set", () => {
    const result = parseArgs(["config", "set", "model", "o3"]);
    expect(result.command).toBe("config");
    expect(result.subcommand).toBe("set");
    expect(result.configKey).toBe("model");
    expect(result.configValue).toBe("o3");
  });

  test("auth login → auth login", () => {
    const result = parseArgs(["auth", "login"]);
    expect(result.command).toBe("auth");
    expect(result.subcommand).toBe("login");
  });

  test("sessions list → sessions list", () => {
    const result = parseArgs(["sessions", "list"]);
    expect(result.command).toBe("sessions");
    expect(result.subcommand).toBe("list");
  });

  test("--model flag sets model override", () => {
    const result = parseArgs(["--model", "o3"]);
    expect(result.flags.model).toBe("o3");
  });

  test("--port flag sets port", () => {
    const result = parseArgs(["--port", "4000"]);
    expect(result.flags.port).toBe(4000);
  });

  test("--no-open flag disables browser open", () => {
    const result = parseArgs(["--no-open"]);
    expect(result.flags.noOpen).toBe(true);
  });

  test("--version flag", () => {
    const result = parseArgs(["--version"]);
    expect(result.command).toBe("version");
  });

  test("--help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.command).toBe("help");
  });

  test("--sandbox flag", () => {
    const result = parseArgs(["--sandbox", "read-only"]);
    expect(result.flags.sandbox).toBe("read-only");
  });

  test("--cwd flag", () => {
    const result = parseArgs(["--cwd", "/tmp/project"]);
    expect(result.flags.cwd).toBe("/tmp/project");
  });
});
