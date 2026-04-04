import { describe, test, expect } from "bun:test";
import { shouldAutoCompact, buildCompactPrompt, estimateTokens } from "../src/context-manager.js";
import type { ChatMessage } from "@clawdex/shared-types";

describe("estimateTokens", () => {
  test("estimates ~4 chars per token", () => {
    const text = "a".repeat(400);
    const tokens = estimateTokens(text);
    expect(tokens).toBeCloseTo(100, -1); // ~100 tokens, allow rough estimate
  });

  test("handles empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("shouldAutoCompact", () => {
  test("returns true when token count exceeds threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 105_000,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(true);
  });

  test("returns false when under threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 50_000,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(false);
  });

  test("returns false at exact threshold", () => {
    expect(
      shouldAutoCompact({
        totalTokens: 102_400,
        contextWindow: 128_000,
        compactThreshold: 0.8,
      })
    ).toBe(false);
  });
});

describe("buildCompactPrompt", () => {
  test("includes message history in compact prompt", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Write a function", timestamp: "2026-01-01T00:00:00Z" },
      { id: "2", role: "assistant", content: "Here is the function...", timestamp: "2026-01-01T00:01:00Z" },
    ];
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain("Write a function");
    expect(prompt).toContain("Here is the function");
    expect(prompt).toContain("summary");
  });

  test("handles empty messages", () => {
    const prompt = buildCompactPrompt([]);
    expect(prompt).toContain("summary");
  });
});
