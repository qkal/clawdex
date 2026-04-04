import { describe, test, expect } from "bun:test";
import { formatExecOutput } from "../src/output.js";
import type { EventMsg } from "@clawdex/shared-types";

describe("formatExecOutput", () => {
  test("text format returns just the message content", () => {
    const events: EventMsg[] = [
      { type: "agent_message", message: "Hello world" } as any,
    ];
    expect(formatExecOutput(events, "text")).toBe("Hello world");
  });

  test("quiet format returns final message only", () => {
    const events: EventMsg[] = [
      { type: "agent_message_delta", delta: "He" } as any,
      { type: "agent_message_delta", delta: "llo" } as any,
      { type: "agent_message", message: "Hello" } as any,
      { type: "turn_complete", turnId: "t1", usage: {} } as any,
    ];
    expect(formatExecOutput(events, "quiet")).toBe("Hello");
  });

  test("json format returns NDJSON", () => {
    const events: EventMsg[] = [
      { type: "agent_message", message: "Hello" } as any,
      { type: "turn_complete", turnId: "t1", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } } as any,
    ];
    const output = formatExecOutput(events, "json");
    const lines = output.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe("agent_message");
    expect(JSON.parse(lines[1]).type).toBe("turn_complete");
  });
});
