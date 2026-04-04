import { describe, test, expect } from "bun:test";
import {
  buildConsolidationPrompt,
  parseConsolidationResult,
} from "../src/consolidate.js";
import type { MemoryEntry } from "../src/types.js";

describe("buildConsolidationPrompt", () => {
  test("includes all memory entries", () => {
    const entries: MemoryEntry[] = [
      {
        id: "1",
        content: "User prefers TypeScript",
        source: "s1",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        content: "Project uses monorepo",
        source: "s2",
        createdAt: "2026-01-02T00:00:00Z",
      },
    ];
    const prompt = buildConsolidationPrompt(entries);
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("monorepo");
    expect(prompt).toContain("consolidate");
  });

  test("handles empty entries", () => {
    const prompt = buildConsolidationPrompt([]);
    expect(prompt).toContain("(no memories)");
  });

  test("includes entry timestamps", () => {
    const entries: MemoryEntry[] = [
      {
        id: "1",
        content: "A fact",
        source: "s1",
        createdAt: "2026-03-15T10:30:00Z",
      },
    ];
    const prompt = buildConsolidationPrompt(entries);
    expect(prompt).toContain("2026-03-15T10:30:00Z");
  });
});

describe("parseConsolidationResult", () => {
  test("extracts summary from LLM response", () => {
    const response =
      "The user prefers TypeScript and uses a monorepo with pnpm workspaces.";
    const result = parseConsolidationResult(response, 2);
    expect(result.summary).toBe(response);
    expect(result.entriesProcessed).toBe(2);
  });

  test("trims whitespace from response", () => {
    const result = parseConsolidationResult("  summary with spaces  \n", 1);
    expect(result.summary).toBe("summary with spaces");
  });

  test("includes timestamp", () => {
    const result = parseConsolidationResult("summary", 0);
    expect(result.timestamp).toBeTruthy();
    // Should be a valid ISO date
    expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
  });
});
