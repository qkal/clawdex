import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ClawdexEngine } from "../src/engine.js";
import type { EventMsg } from "@clawdex/shared-types";
import { createTestConfig } from "@clawdex/testkit";
import { MockSandbox } from "@clawdex/testkit";
import { ToolRegistry } from "@clawdex/tools";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Minimal auth provider for testing
const mockAuthProvider = {
  getToken: async () => ({ token: "test-api-key", expiresAt: undefined }),
  getStatus: async () => ({ authenticated: true, method: "api_key" as const }),
  logout: async () => {},
};

describe("ClawdexEngine", () => {
  let sessionsDir: string;
  let engine: ClawdexEngine;

  beforeEach(async () => {
    sessionsDir = await mkdtemp(join(tmpdir(), "clawdex-engine-"));
    engine = new ClawdexEngine({
      config: createTestConfig(),
      authProvider: mockAuthProvider,
      sandbox: new MockSandbox(),
      toolRegistry: new ToolRegistry(),
      sessionsDir,
    });
  });

  afterEach(async () => {
    await rm(sessionsDir, { recursive: true, force: true });
  });

  test("createSession returns a new session with generated id", async () => {
    const session = await engine.createSession({ workingDir: "/tmp/project" });
    expect(session.id).toHaveLength(12);
    expect(session.workingDir).toBe("/tmp/project");
    expect(session.model).toBe("gpt-4o"); // from default config
  });

  test("createSession with custom name", async () => {
    const session = await engine.createSession({
      workingDir: "/tmp",
      name: "test session",
    });
    expect(session.name).toBe("test session");
  });

  test("getSession returns created session", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    const found = engine.getSession(session.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(session.id);
  });

  test("getSession returns null for unknown id", () => {
    expect(engine.getSession("nonexistent")).toBeNull();
  });

  test("listSessions returns all active sessions", async () => {
    await engine.createSession({ workingDir: "/a" });
    await engine.createSession({ workingDir: "/b" });
    const list = await engine.listSessions();
    expect(list).toHaveLength(2);
  });

  test("deleteSession removes session and persisted file", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    await engine.deleteSession(session.id);
    expect(engine.getSession(session.id)).toBeNull();
  });

  test("setSessionName updates name", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    await engine.setSessionName(session.id, "renamed");
    expect(engine.getSession(session.id)!.name).toBe("renamed");
  });

  test("loadSession restores a session from disk", async () => {
    const session = await engine.createSession({ workingDir: "/tmp" });
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: new Date().toISOString(),
    });
    // Persist it
    await engine.saveSession(session.id);

    // Create a new engine pointing to same dir
    const engine2 = new ClawdexEngine({
      config: createTestConfig(),
      authProvider: mockAuthProvider,
      sandbox: new MockSandbox(),
      toolRegistry: new ToolRegistry(),
      sessionsDir,
    });
    const loaded = await engine2.loadSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(1);
  });

  test("on/off event listener management", async () => {
    const events: EventMsg[] = [];
    const handler = (e: EventMsg) => { events.push(e); };

    engine.on("event", handler);
    await engine.emit({
      type: "turn_started",
      turnId: "t1",
      model: "gpt-4o",
    } as EventMsg);
    expect(events).toHaveLength(1);

    engine.off("event", handler);
    await engine.emit({
      type: "turn_started",
      turnId: "t2",
      model: "gpt-4o",
    } as EventMsg);
    expect(events).toHaveLength(1); // not incremented
  });
});
