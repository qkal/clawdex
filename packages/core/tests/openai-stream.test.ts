import { describe, test, expect } from "bun:test";
import {
  parseSSELine,
  createOpenAIStream,
  type OpenAIStreamConfig,
} from "../src/openai-stream.js";
import type { OpenAIStreamEvent } from "../src/types.js";

describe("parseSSELine", () => {
  test("parses a data line into JSON", () => {
    const event = parseSSELine(
      'data: {"type":"response.output_text.delta","delta":"Hello"}'
    );
    expect(event).toEqual({ type: "response.output_text.delta", delta: "Hello" });
  });

  test("returns null for empty lines", () => {
    expect(parseSSELine("")).toBeNull();
    expect(parseSSELine("\n")).toBeNull();
  });

  test("returns done event for [DONE]", () => {
    expect(parseSSELine("data: [DONE]")).toEqual({ type: "response.done" });
  });

  test("returns null for comment lines", () => {
    expect(parseSSELine(": keep-alive")).toBeNull();
  });

  test("returns null for non-data lines", () => {
    expect(parseSSELine("event: message")).toBeNull();
  });
});

describe("createOpenAIStream", () => {
  function mockFetchResponse(events: string[]): () => Promise<Response> {
    return async () => {
      const body = events.join("\n\n") + "\n\n";
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };
  }

  test("streams text deltas from SSE events", async () => {
    const events = [
      'data: {"type":"response.output_text.delta","delta":"Hello "}',
      'data: {"type":"response.output_text.delta","delta":"world"}',
      'data: {"type":"response.output_text.done","text":"Hello world"}',
      'data: {"type":"response.completed","usage":{"input_tokens":10,"output_tokens":5}}',
      "data: [DONE]",
    ];

    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetchResponse(events));
    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toHaveLength(5);
    expect(collected[0]).toEqual({ type: "response.output_text.delta", delta: "Hello " });
    expect(collected[3]).toEqual({
      type: "response.completed",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(collected[4]).toEqual({ type: "response.done" });
  });

  test("yields error event on non-200 response", async () => {
    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    const mockFetch = async () =>
      new Response('{"error":{"message":"Rate limited"}}', { status: 429 });

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetch);
    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toHaveLength(1);
    expect(collected[0].type).toBe("response.error");
  });
});
