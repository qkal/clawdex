import { describe, test, expect } from "bun:test";
import { TurnRunner } from "../src/turn-runner.js";
import type { EventMsg } from "@clawdex/shared-types";
import type { OpenAIStreamEvent } from "../src/types.js";
import { ToolRegistry } from "@clawdex/tools";
import { MockSandbox } from "@clawdex/testkit";

/** Helper: build a mock stream function that yields canned events. */
function mockStreamFn(events: OpenAIStreamEvent[]) {
  return async function* (_messages: import("../src/types.js").OpenAIMessage[]) {
    for (const e of events) {
      yield e;
    }
  };
}

describe("TurnRunner", () => {
  test("emits turn_started, agent_message_delta, agent_message, turn_complete for a simple text response", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.output_text.delta", delta: "Hello " },
      { type: "response.output_text.delta", delta: "world" },
      { type: "response.output_text.done", text: "Hello world" },
      { type: "response.completed", usage: { input_tokens: 10, output_tokens: 5 } },
      { type: "response.done" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-1",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("turn_started");
    expect(types).toContain("agent_message_delta");
    expect(types).toContain("agent_message");
    expect(types).toContain("turn_complete");

    // Check delta contents
    const deltas = emitted
      .filter((e): e is EventMsg & { type: "agent_message_delta" } => e.type === "agent_message_delta");
    expect(deltas).toHaveLength(2);

    // Check final message
    const msg = emitted.find((e) => e.type === "agent_message") as any;
    expect(msg.message).toBe("Hello world");

    // Check usage in turn_complete
    const complete = emitted.find((e) => e.type === "turn_complete") as any;
    expect(complete.usage.inputTokens).toBe(10);
    expect(complete.usage.outputTokens).toBe(5);
  });

  test("dispatches tool calls and feeds results back", async () => {
    // First stream: LLM requests a tool call
    const stream1: OpenAIStreamEvent[] = [
      { type: "response.function_call_arguments.done", call_id: "call-1", name: "file-read", arguments: '{"path":"/tmp/x.txt"}' },
      { type: "response.completed", usage: { input_tokens: 20, output_tokens: 10 } },
      { type: "response.done" },
    ];

    // Second stream: LLM produces final text
    const stream2: OpenAIStreamEvent[] = [
      { type: "response.output_text.done", text: "File says hello" },
      { type: "response.completed", usage: { input_tokens: 30, output_tokens: 15 } },
      { type: "response.done" },
    ];

    let streamCall = 0;
    const invocations: import("../src/types.js").OpenAIMessage[][] = [];
    const createStream = async function* (messages: import("../src/types.js").OpenAIMessage[]) {
      invocations.push([...messages]);
      const events = streamCall === 0 ? stream1 : stream2;
      streamCall++;
      for (const e of events) {
        yield e;
      }
    };

    // Register a mock file-read tool
    const registry = new ToolRegistry();
    registry.register({
      name: "file-read",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
      execute: async (_call) => ({
        output: "hello from file",
        success: true,
      }),
    });

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-2",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: registry,
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream,
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("tool_call_begin");
    expect(types).toContain("tool_call_end");
    expect(types).toContain("turn_aborted");
    // Assert that second invocation includes tool result
    expect(invocations).toHaveLength(2);
    const secondCallMessages = invocations[1];
    const hasToolResult = secondCallMessages.some(
      (msg) => msg.role === "tool" && msg.content === "hello from file"
    );
    expect(hasToolResult).toBe(true);
  });

  test("emits turn_aborted on stream error", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.error", message: "Rate limited" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-3",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("error");
    expect(types).toContain("turn_aborted");
  });

  test("emits reasoning deltas when present", async () => {
    const events: OpenAIStreamEvent[] = [
      { type: "response.reasoning_summary_text.delta", delta: "Thinking..." },
      { type: "response.reasoning_summary_text.done", text: "Thinking..." },
      { type: "response.output_text.done", text: "Done" },
      { type: "response.completed", usage: { input_tokens: 10, output_tokens: 5 } },
      { type: "response.done" },
    ];

    const emitted: EventMsg[] = [];
    const runner = new TurnRunner({
      turnId: "turn-4",
      model: "gpt-4o",
      workingDir: "/tmp",
      toolRegistry: new ToolRegistry(),
      sandbox: new MockSandbox(),
      emitEvent: async (e) => { emitted.push(e); },
      createStream: mockStreamFn(events),
    });

    await runner.run();

    const types = emitted.map((e) => e.type);
    expect(types).toContain("agent_reasoning_delta");
    expect(types).toContain("agent_reasoning");
  });
});