import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ShellTool } from "../src/shell";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("ShellTool", () => {
  let tempDir: string;
  let tool: ShellTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new ShellTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true }).catch(() => {});
  });

  test("has correct name", () => {
    expect(tool.name).toBe("shell");
  });

  test("executes a simple command", async () => {
    const call: ToolCall = {
      callId: "c1",
      tool: "shell",
      args: { command: "echo hello" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  test("captures stderr", async () => {
    const call: ToolCall = {
      callId: "c2",
      tool: "shell",
      args: { command: "echo error >&2" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.output).toContain("error");
  });

  test("returns non-zero exit code on failure", async () => {
    const call: ToolCall = {
      callId: "c3",
      tool: "shell",
      args: { command: "exit 42" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(42);
  });

  test("runs in the correct working directory", async () => {
    // Use a command that works on both cmd.exe and bash to verify cwd
    const command = process.platform === "win32" ? "cd" : "pwd";
    const call: ToolCall = {
      callId: "c4",
      tool: "shell",
      args: { command },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    // Normalize paths for cross-platform comparison
    const actual = result.output.trim().replace(/\\/g, "/").toLowerCase();
    const expected = tempDir.replace(/\\/g, "/").toLowerCase();
    expect(actual).toContain(expected);
  });

  test("checks sandbox before executing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { exec: ["rm -rf"] },
    });
    const ctx2: ToolContext = { workingDir: tempDir, sandbox };
    const call: ToolCall = {
      callId: "c5",
      tool: "shell",
      args: { command: "rm -rf /" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });

  test("respects timeout", async () => {
    // Use a separate context to avoid EBUSY on tempDir cleanup from killed process
    const timeoutDir = await mkdtemp(join(tmpdir(), "clawdex-timeout-"));
    const timeoutCtx: ToolContext = { workingDir: timeoutDir, sandbox: new MockSandbox() };
    const sleepCmd = process.platform === "win32" ? "ping -n 60 127.0.0.1 >nul" : "sleep 60";
    const call: ToolCall = {
      callId: "c6",
      tool: "shell",
      args: { command: sleepCmd, timeout_ms: 500 },
    };
    const result = await tool.execute(call, timeoutCtx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("timed out");
    // Clean up; ignore errors from busy resources after kill
    await rm(timeoutDir, { recursive: true }).catch(() => {});
  }, 10000);
});
