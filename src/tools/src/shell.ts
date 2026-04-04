import { resolve } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ShellTool implements ITool {
  readonly name = "shell";
  readonly description = "Execute a shell command in the working directory. Returns stdout, stderr, and exit code.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      timeout_ms: { type: "string", description: "Timeout in milliseconds (default: 30000)" },
    },
    required: ["command"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const command = call.args.command as string;
    const timeoutMs = (call.args.timeout_ms as number) ?? DEFAULT_TIMEOUT_MS;
    const cwd = resolve(ctx.workingDir);

    const check = ctx.sandbox.checkExec(command);
    if (!check.allowed) {
      return {
        output: `Permission denied: execution not allowed. ${check.reason ?? ""}`.trim(),
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

      const proc = Bun.spawn([shell, ...shellArgs], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env },
      });

      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), timeoutMs),
      );

      const exitPromise = proc.exited.then((code) => ({ code }));
      const raceResult = await Promise.race([exitPromise, timeoutPromise]);

      if (raceResult === "timeout") {
        proc.kill();
        return {
          output: `Command timed out after ${timeoutMs}ms: ${command}`,
          success: false,
          exitCode: -1,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = raceResult.code;
      const output = [stdout, stderr].filter(Boolean).join("\n");

      return {
        output,
        success: exitCode === 0,
        exitCode,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to execute command: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
