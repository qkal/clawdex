import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyPatchTool } from "../src/apply-patch";
import { MockSandbox } from "@clawdex/testkit";
import type { ToolCall, ToolContext } from "@clawdex/shared-types";

describe("ApplyPatchTool", () => {
  let tempDir: string;
  let tool: ApplyPatchTool;
  let ctx: ToolContext;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    tool = new ApplyPatchTool();
    ctx = { workingDir: tempDir, sandbox: new MockSandbox() };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("has correct name", () => {
    expect(tool.name).toBe("apply_patch");
  });

  test("creates a new file", async () => {
    const patch = `--- /dev/null
+++ new-file.txt
@@ -0,0 +1,2 @@
+line one
+line two
`;
    const call: ToolCall = {
      callId: "c1",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const content = await readFile(join(tempDir, "new-file.txt"), "utf-8");
    expect(content).toBe("line one\nline two\n");
  });

  test("modifies an existing file", async () => {
    await writeFile(join(tempDir, "existing.txt"), "old line\n");
    const patch = `--- existing.txt
+++ existing.txt
@@ -1 +1 @@
-old line
+new line
`;
    const call: ToolCall = {
      callId: "c2",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const content = await readFile(join(tempDir, "existing.txt"), "utf-8");
    expect(content).toBe("new line\n");
  });

  test("deletes a file", async () => {
    await writeFile(join(tempDir, "to-delete.txt"), "content\n");
    const patch = `--- to-delete.txt
+++ /dev/null
@@ -1 +0,0 @@
-content
`;
    const call: ToolCall = {
      callId: "c3",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx);
    expect(result.success).toBe(true);
    const exists = await Bun.file(join(tempDir, "to-delete.txt")).exists();
    expect(exists).toBe(false);
  });

  test("checks sandbox before writing", async () => {
    const sandbox = new MockSandbox({
      denyPatterns: { fileWrite: ["/etc"] },
    });
    const ctx2: ToolContext = { workingDir: "/", sandbox };
    const patch = `--- /dev/null
+++ /etc/evil.txt
@@ -0,0 +1 @@
+hacked
`;
    const call: ToolCall = {
      callId: "c4",
      tool: "apply_patch",
      args: { patch },
    };
    const result = await tool.execute(call, ctx2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("denied");
  });
});
