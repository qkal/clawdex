import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileReadTool } from "../src/file-read";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("FileReadTool", () => {
  let tempDir: string;
  let tool: FileReadTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new FileReadTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("has correct name and description", () => {
    expect(tool.name).toBe("file_read");
    expect(tool.description).toContain("Read");
  });

  test("reads file contents", async () => {
    await writeFile(join(tempDir, "test.txt"), "hello world");
    const call: ToolCall = {
      callId: "c1",
      tool: "file_read",
      args: { path: "test.txt" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello world");
  });

  test("resolves relative paths against workingDir", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "index.ts"), "export {}");
    const call: ToolCall = {
      callId: "c2",
      tool: "file_read",
      args: { path: "src/index.ts" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe("export {}");
  });

  test("returns error for missing file", async () => {
    const call: ToolCall = {
      callId: "c3",
      tool: "file_read",
      args: { path: "nonexistent.txt" },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  test("checks sandbox before reading", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileRead: ["/etc/shadow"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const call: ToolCall = {
      callId: "c4",
      tool: "file_read",
      args: { path: "/etc/shadow" },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
