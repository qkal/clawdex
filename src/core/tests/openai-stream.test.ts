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
  function mockFetchResponse(events: string[]): (url?: string, init?: RequestInit) => Promise<Response> {
    return async (_url?: string, _init?: RequestInit) => {
      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(`data: ${event}\n\n`));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };
  }

  test("streams text deltas from SSE events", async () => {
    const events = [
      '{"type":"response.output_text.delta","delta":"Hello "}',
      '{"type":"response.output_text.delta","delta":"world"}',
      '{"type":"response.output_text.done","text":"Hello world"}',
      '{"type":"response.completed","usage":{"input_tokens":10,"output_tokens":5}}',
      "[DONE]",
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

    // 429 is retryable — after MAX_RETRIES the generator yields a final error.
    // Use a 400 (non-retryable) to get an immediate single error event.
    const mockFetch = async () =>
      new Response('{"error":{"message":"Bad request"}}', { status: 400 });

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetch);
    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toHaveLength(1);
    expect(collected[0].type).toBe("response.error");
  });

  test("retries on 429 and yields stream_retrying events before final error", async () => {
    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    // Always return 429 so all retries are exhausted.
    const mockFetch = async () =>
      new Response('{"error":{"message":"Rate limited"}}', { status: 429 });
    const noSleep = async () => {};

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetch, noSleep);
    for await (const event of stream) {
      collected.push(event);
    }

    // Expect MAX_RETRIES=3 stream_retrying events followed by one response.error.
    const retrying = collected.filter((e) => e.type === "stream_retrying");
    const errors = collected.filter((e) => e.type === "response.error");
    expect(retrying).toHaveLength(3);
    expect(errors).toHaveLength(1);
    // Attempt numbers should be 1, 2, 3.
    const attempts = retrying.map((e) => (e as { type: "stream_retrying"; attempt: number }).attempt);
    expect(attempts).toEqual([1, 2, 3]);
  });

  test("succeeds after transient 503 errors", async () => {
    const config: OpenAIStreamConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    };

    const successEvents = [
      '{"type":"response.output_text.delta","delta":"Hi"}',
      '{"type":"response.done"}',
    ];

    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("Service Unavailable", { status: 503 });
      }
      const stream = new ReadableStream({
        start(controller) {
          for (const event of successEvents) {
            controller.enqueue(new TextEncoder().encode(`data: ${event}\n\n`));
          }
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
    const noSleep = async () => {};

    const collected: OpenAIStreamEvent[] = [];
    const stream = createOpenAIStream(config, mockFetch, noSleep);
    for await (const event of stream) {
      collected.push(event);
    }

    // Two stream_retrying events then the actual response events.
    const retrying = collected.filter((e) => e.type === "stream_retrying");
    const deltas = collected.filter((e) => e.type === "response.output_text.delta");
    expect(retrying).toHaveLength(2);
    expect(deltas).toHaveLength(1);
    expect(callCount).toBe(3);
  });
});
