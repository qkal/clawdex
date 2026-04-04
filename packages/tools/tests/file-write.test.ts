import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileWriteTool } from "../src/file-write";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("FileWriteTool", () => {
  let tempDir: string;
  let tool: FileWriteTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new FileWriteTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("writes file contents", async () => {
    const call: ToolCall = {
      callId: "c1",
      tool: "file_write",
      args: { path: "output.txt", content: "hello world" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const written = await readFile(join(tempDir, "output.txt"), "utf-8");
    expect(written).toBe("hello world");
  });

  test("creates parent directories", async () => {
    const call: ToolCall = {
      callId: "c2",
      tool: "file_write",
      args: { path: "deep/nested/file.ts", content: "export {}" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const written = await readFile(join(tempDir, "deep", "nested", "file.ts"), "utf-8");
    expect(written).toBe("export {}");
  });

  test("checks sandbox before writing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileWrite: ["/etc"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const call: ToolCall = {
      callId: "c3",
      tool: "file_write",
      args: { path: "/etc/passwd", content: "hacked" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
