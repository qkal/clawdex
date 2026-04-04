import { describe, expect, test } from "bun:test";
import type {
  Submission,
  Op,
  Event,
  EventMsg,
  TokenUsage,
  FileDiff,
  RiskLevel,
} from "../src/events";

describe("Submission types", () => {
  test("user_turn submission has correct shape", () => {
    const sub: Submission = {
      id: "s1",
      op: {
        type: "user_turn",
        prompt: "hello",
        sessionId: "abc123",
      },
    };
    expect(sub.id).toBe("s1");
    expect(sub.op.type).toBe("user_turn");
  });

  test("interrupt submission", () => {
    const sub: Submission = { id: "s2", op: { type: "interrupt" } };
    expect(sub.op.type).toBe("interrupt");
  });

  test("exec_approval submission", () => {
    const sub: Submission = {
      id: "s3",
      op: { type: "exec_approval", callId: "c1", decision: "approve" },
    };
    expect(sub.op.type).toBe("exec_approval");
  });
});

describe("Event types", () => {
  test("turn_started event", () => {
    const evt: Event = {
      submissionId: "s1",
      msg: { type: "turn_started", turnId: "t1", model: "gpt-4o" },
    };
    expect(evt.msg.type).toBe("turn_started");
  });

  test("agent_message_delta event", () => {
    const evt: Event = {
      msg: { type: "agent_message_delta", delta: "Hello" },
    };
    expect(evt.msg.type).toBe("agent_message_delta");
  });

  test("exec_command lifecycle events", () => {
    const begin: EventMsg = {
      type: "exec_command_begin",
      callId: "c1",
      command: "npm test",
      cwd: "/project",
    };
    const delta: EventMsg = {
      type: "exec_command_output_delta",
      callId: "c1",
      chunk: "PASS",
      stream: "stdout",
    };
    const end: EventMsg = {
      type: "exec_command_end",
      callId: "c1",
      exitCode: 0,
    };
    expect(begin.type).toBe("exec_command_begin");
    expect(delta.type).toBe("exec_command_output_delta");
    expect(end.type).toBe("exec_command_end");
  });

  test("error event with code", () => {
    const evt: Event = {
      msg: {
        type: "error",
        message: "already running",
        code: "TURN_IN_PROGRESS",
        fatal: false,
      },
    };
    expect(evt.msg.type).toBe("error");
  });
});

describe("supporting types", () => {
  test("TokenUsage", () => {
    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };
    expect(usage.totalTokens).toBe(150);
  });

  test("FileDiff", () => {
    const diff: FileDiff = {
      path: "src/index.ts",
      status: "modified",
      before: "const x = 1;",
      after: "const x = 2;",
      isBinary: false,
      truncated: false,
    };
    expect(diff.status).toBe("modified");
  });

  test("RiskLevel values", () => {
    const low: RiskLevel = "low";
    const medium: RiskLevel = "medium";
    const high: RiskLevel = "high";
    expect(low).toBe("low");
    expect(medium).toBe("medium");
    expect(high).toBe("high");
  });
});
