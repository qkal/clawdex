import { describe, test, expect, beforeEach } from "bun:test";
import { Session } from "../src/session.js";
import type { ChatMessage, TokenUsage } from "@clawdex/shared-types";

describe("Session", () => {
  let session: Session;

  beforeEach(() => {
    session = new Session({
      workingDir: "/tmp/test-project",
      model: "gpt-4o",
      sandboxPolicy: "workspace-write",
    });
  });

  test("generates a 12-char nanoid as id", () => {
    expect(session.id).toHaveLength(12);
    expect(session.id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  test("initializes with empty messages and zero usage", () => {
    expect(session.messages).toEqual([]);
    expect(session.tokenUsage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  test("addMessage appends and updates lastActiveAt", () => {
    const before = session.lastActiveAt;
    const msg: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: new Date().toISOString(),
    };
    session.addMessage(msg);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toEqual(msg);
    expect(session.lastActiveAt >= before).toBe(true);
  });

  test("addTokenUsage accumulates correctly", () => {
    session.addTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
    session.addTokenUsage({ inputTokens: 200, outputTokens: 100, totalTokens: 300 });
    expect(session.tokenUsage).toEqual({
      inputTokens: 300,
      outputTokens: 150,
      totalTokens: 450,
    });
  });

  test("setName updates the session name", () => {
    expect(session.name).toBeUndefined();
    session.setName("my session");
    expect(session.name).toBe("my session");
  });

  test("toSnapshot returns a complete SessionSnapshot", () => {
    session.setName("test");
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hi",
      timestamp: new Date().toISOString(),
    });
    const snap = session.toSnapshot();
    expect(snap.summary.id).toBe(session.id);
    expect(snap.summary.name).toBe("test");
    expect(snap.summary.messageCount).toBe(1);
    expect(snap.messages).toHaveLength(1);
    expect(snap.workingDir).toBe("/tmp/test-project");
    expect(snap.model).toBe("gpt-4o");
    expect(snap.sandboxPolicy).toBe("workspace-write");
  });

  test("toSummary returns minimal session info", () => {
    const summary = session.toSummary();
    expect(summary.id).toBe(session.id);
    expect(summary.messageCount).toBe(0);
    expect(summary.workingDir).toBe("/tmp/test-project");
  });

  test("popLastTurnMessages removes messages from the last turn", () => {
    session.addMessage({
      id: "msg-1", role: "user", content: "first",
      timestamp: new Date().toISOString(), turnId: "turn-1",
    });
    session.addMessage({
      id: "msg-2", role: "assistant", content: "reply to first",
      timestamp: new Date().toISOString(), turnId: "turn-1",
    });
    session.addMessage({
      id: "msg-3", role: "user", content: "second",
      timestamp: new Date().toISOString(), turnId: "turn-2",
    });
    session.addMessage({
      id: "msg-4", role: "assistant", content: "reply to second",
      timestamp: new Date().toISOString(), turnId: "turn-2",
    });

    const removed = session.popLastTurnMessages();
    expect(removed).toHaveLength(2);
    expect(removed[0].turnId).toBe("turn-2");
    expect(session.messages).toHaveLength(2);
  });
});
