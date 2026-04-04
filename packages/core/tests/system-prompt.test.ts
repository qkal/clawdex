import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../src/system-prompt.js";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { createTestConfig } from "@clawdex/testkit";

describe("buildSystemPrompt", () => {
  test("includes model name and working directory", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/home/user/project",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).toContain("gpt-4o");
    expect(prompt).toContain("/home/user/project");
  });

  test("includes developer instructions when set", () => {
    const config = createTestConfig({ developer_instructions: "Always use TypeScript" });
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).toContain("Always use TypeScript");
  });

  test("omits developer instructions when empty", () => {
    const config = createTestConfig({ developer_instructions: "" });
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    expect(prompt).not.toContain("Developer Instructions");
  });

  test("includes sandbox policy", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "read-only",
    });
    expect(prompt).toContain("read-only");
  });

  test("includes platform info", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    // Should include the current platform
    expect(prompt).toContain(process.platform);
  });

  test("includes current date", () => {
    const config = createTestConfig();
    const prompt = buildSystemPrompt({
      config,
      model: "gpt-4o",
      workingDir: "/tmp",
      sandboxPolicy: "workspace-write",
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(prompt).toContain(today);
  });
});
