import { describe, expect, test } from "bun:test";
import { MockLLMClient } from "../src/mock-llm.js";

describe("MockLLMClient", () => {
  test("streams configured response chunks", async () => {
    const client = new MockLLMClient({
      responses: ["Hello", " world", "!"],
    });

    const chunks: string[] = [];
    for await (const chunk of client.stream("test prompt")) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world", "!"]);
  });

  test("returns configured tool calls", async () => {
    const client = new MockLLMClient({
      toolCalls: [
        { tool: "file_read", args: { path: "src/index.ts" } },
      ],
    });

    const result = await client.complete("test prompt");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].tool).toBe("file_read");
  });

  test("tracks call history", async () => {
    const client = new MockLLMClient({ responses: ["ok"] });

    for await (const chunk of client.stream("first")) {
      void chunk;
    }
    for await (const chunk of client.stream("second")) {
      void chunk;
    }

    expect(client.history).toHaveLength(2);
    expect(client.history[0]).toBe("first");
    expect(client.history[1]).toBe("second");
  });

  test("empty responses produces empty stream", async () => {
    const client = new MockLLMClient({ responses: [] });
    const chunks: string[] = [];
    for await (const chunk of client.stream("test")) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([]);
  });
});
