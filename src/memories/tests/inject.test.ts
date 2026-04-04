import { describe, test, expect } from "bun:test";
import { buildMemoryContext } from "../src/inject.js";

describe("buildMemoryContext", () => {
  test("includes summary when available", () => {
    const ctx = buildMemoryContext("User works with TypeScript monorepos.");
    expect(ctx).toContain("TypeScript monorepos");
    expect(ctx).toContain("Memory");
  });

  test("returns empty string when no summary", () => {
    expect(buildMemoryContext(null)).toBe("");
    expect(buildMemoryContext("")).toBe("");
  });

  test("includes section header", () => {
    const ctx = buildMemoryContext("Some memories here.");
    expect(ctx).toContain("## Memory (from previous sessions)");
  });
});
