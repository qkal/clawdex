import type { EventMsg, ToolCall, ToolContext } from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";
import type { ISandbox } from "@clawdex/shared-types";
import type { OpenAIStreamEvent, OpenAIMessage } from "./types.js";
import { dispatchToolCall } from "./tool-dispatch.js";

export interface TurnRunnerOptions {
  turnId: string;
  model: string;
  workingDir: string;
  toolRegistry: ToolRegistry;
  sandbox: ISandbox;
  /** Callback to emit events to the session/server layer. */
  emitEvent: (event: EventMsg) => Promise<void>;
  /** Factory to create the OpenAI stream for a given message list. Called once per
   *  API request (may be called multiple times if tool calls create a loop). */
  createStream: (messages: OpenAIMessage[]) => AsyncGenerator<OpenAIStreamEvent>;
  /** Initial messages (system prompt + conversation history). Extended with tool
   *  call/result pairs as the tool-call loop progresses. Defaults to empty array. */
  messages?: OpenAIMessage[];
  /** Max tool-call loop iterations to prevent infinite loops. */
  maxToolRounds?: number;
}

interface PendingToolCall {
  callId: string;
  name: string;
  argumentChunks: string[];
}

export class TurnRunner {
  private readonly opts: TurnRunnerOptions;
  private readonly maxToolRounds: number;
  private interrupted = false;

  constructor(opts: TurnRunnerOptions) {
    this.opts = opts;
    this.maxToolRounds = opts.maxToolRounds ?? 10;
  }

  /** Signal the runner to abort the current turn. */
  interrupt(): void {
    this.interrupted = true;
  }

  /** Execute the turn: stream -> collect -> dispatch tools -> loop or complete. */
  async run(): Promise<void> {
    await this.opts.emitEvent({
      type: "turn_started",
      turnId: this.opts.turnId,
      model: this.opts.model,
    } as EventMsg);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Maintain a running message list that grows with each tool-call round
    const currentMessages: OpenAIMessage[] = [...(this.opts.messages ?? [])];

    for (let round = 0; round < this.maxToolRounds; round++) {
      if (this.interrupted) {
        await this.opts.emitEvent({
          type: "turn_aborted",
          turnId: this.opts.turnId,
          reason: "user_interrupted",
        } as EventMsg);
        return;
      }

      const { textContent, reasoningContent, toolCalls, usage, error } =
        await this.processStream(currentMessages);

      if (this.interrupted) {
        await this.opts.emitEvent({
          type: "turn_aborted",
          turnId: this.opts.turnId,
          reason: "user_interrupted",
        } as EventMsg);
        return;
      }

      if (error) {
        await this.opts.emitEvent({
          type: "error",
          message: error,
          fatal: false,
        } as EventMsg);
        await this.opts.emitEvent({
          type: "turn_aborted",
          turnId: this.opts.turnId,
          reason: "error",
        } as EventMsg);
        return;
      }

      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;

      // Emit final reasoning summary if present
      if (reasoningContent) {
        await this.opts.emitEvent({
          type: "agent_reasoning",
          summary: reasoningContent,
        } as EventMsg);
      }

      // If no tool calls, emit final message and complete
      if (toolCalls.length === 0) {
        if (textContent) {
          await this.opts.emitEvent({
            type: "agent_message",
            message: textContent,
          } as EventMsg);
        }

        await this.opts.emitEvent({
          type: "turn_complete",
          turnId: this.opts.turnId,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
          },
        } as EventMsg);
        return;
      }

      // Dispatch tool calls and collect results
      const ctx: ToolContext = {
        workingDir: this.opts.workingDir,
        sandbox: this.opts.sandbox,
      };

      for (const tc of toolCalls) {
        if (this.interrupted) {
          await this.opts.emitEvent({
            type: "turn_aborted",
            turnId: this.opts.turnId,
            reason: "user_interrupted",
          } as EventMsg);
          return;
        }

        let args: unknown;
        try {
          args = JSON.parse(tc.arguments);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown JSON parse error";
          await this.opts.emitEvent({
            type: "error",
            message: `Failed to parse tool arguments for "${tc.name}" (${tc.callId}): ${message}`,
            fatal: false,
          } as EventMsg);
          await this.opts.emitEvent({
            type: "turn_aborted",
            turnId: this.opts.turnId,
            reason: "error",
          } as EventMsg);
          return;
        }

        const call: ToolCall = {
          callId: tc.callId,
          tool: tc.name,
          args,
        };

        if (this.interrupted) {
          await this.opts.emitEvent({
            type: "turn_aborted",
            turnId: this.opts.turnId,
            reason: "user_interrupted",
          } as EventMsg);
          return;
        }

        await this.opts.emitEvent({
          type: "tool_call_begin",
          callId: call.callId,
          tool: call.tool,
          args: call.args,
        } as EventMsg);

        const result = await dispatchToolCall(this.opts.toolRegistry, call, ctx);

        await this.opts.emitEvent({
          type: "tool_call_end",
          callId: call.callId,
          output: result.output,
          success: result.success,
        } as EventMsg);

        // Append function_call item (assistant's request) and its output so
        // the next API request sees the full tool-call exchange.
        currentMessages.push({
          type: "function_call",
          call_id: tc.callId,
          name: tc.name,
          arguments: tc.arguments,
        });
        currentMessages.push({
          role: "tool",
          tool_call_id: tc.callId,
          content: result.output,
        });
      }
    }

    // If we exhausted tool rounds, emit abort event
    await this.opts.emitEvent({
      type: "turn_aborted",
      turnId: this.opts.turnId,
      reason: "maxToolRounds exhausted",
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    } as EventMsg);
  }

  /** Process a single stream from the API, collecting text, reasoning, and tool calls. */
  private async processStream(messages: OpenAIMessage[]): Promise<{
    textContent: string;
    reasoningContent: string;
    toolCalls: Array<{ callId: string; name: string; arguments: string }>;
    usage: { inputTokens: number; outputTokens: number };
    error: string | null;
  }> {
    let textContent = "";
    let reasoningContent = "";
    const pendingToolCalls = new Map<string, PendingToolCall>();
    const completedToolCalls: Array<{ callId: string; name: string; arguments: string }> = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    const stream = this.opts.createStream(messages);

    for await (const event of stream) {
      if (this.interrupted) break;

      switch (event.type) {
        case "response.output_text.delta":
          await this.opts.emitEvent({
            type: "agent_message_delta",
            delta: event.delta,
          } as EventMsg);
          textContent += event.delta;
          break;

        case "response.output_text.done":
          textContent = event.text;
          break;

        case "response.reasoning_summary_text.delta":
          await this.opts.emitEvent({
            type: "agent_reasoning_delta",
            delta: event.delta,
          } as EventMsg);
          reasoningContent += event.delta;
          break;

        case "response.reasoning_summary_text.done":
          reasoningContent = event.text;
          break;

        case "response.function_call_arguments.delta": {
          let pending = pendingToolCalls.get(event.call_id);
          if (!pending) {
            pending = { callId: event.call_id, name: "", argumentChunks: [] };
            pendingToolCalls.set(event.call_id, pending);
          }
          pending.argumentChunks.push(event.delta);
          break;
        }

        case "response.function_call_arguments.done":
          completedToolCalls.push({
            callId: event.call_id,
            name: event.name,
            arguments: event.arguments,
          });
          pendingToolCalls.delete(event.call_id);
          break;

        case "response.completed":
          usage = {
            inputTokens: event.usage.input_tokens,
            outputTokens: event.usage.output_tokens,
          };
          break;

        case "response.error":
          return {
            textContent,
            reasoningContent,
            toolCalls: completedToolCalls,
            usage,
            error: event.message,
          };

        case "response.done":
          break;
      }
    }

    return {
      textContent,
      reasoningContent,
      toolCalls: completedToolCalls,
      usage,
      error: null,
    };
  }
}