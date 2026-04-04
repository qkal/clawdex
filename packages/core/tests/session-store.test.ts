import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../src/session-store.js";
import { Session } from "../src/session.js";

describe("SessionStore", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-session-store-"));
    store = new SessionStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save and load round-trips a session", async () => {
    const session = new Session({
      workingDir: "/tmp/project",
      model: "gpt-4o",
      sandboxPolicy: "workspace-write",
    });
    session.setName("my session");
    session.addMessage({
      id: "msg-1",
      role: "user",
      content: "hello",
      timestamp: "2026-04-04T10:00:00Z",
    });
    session.addTokenUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });

    await store.save(session);
    const loaded = await store.load(session.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
    expect(loaded!.name).toBe("my session");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.workingDir).toBe("/tmp/project");
    expect(loaded!.model).toBe("gpt-4o");
  });

  test("load returns null for nonexistent session", async () => {
    const loaded = await store.load("nonexistent");
    expect(loaded).toBeNull();
  });

  test("list returns summaries of all sessions", async () => {
    const s1 = new Session({ workingDir: "/a", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    const s2 = new Session({ workingDir: "/b", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    s1.setName("first");
    s2.setName("second");

    await store.save(s1);
    await store.save(s2);

    const list = await store.list();
    expect(list).toHaveLength(2);
    const names = list.map((s) => s.name).sort();
    expect(names).toEqual(["first", "second"]);
  });

  test("delete removes a session file", async () => {
    const session = new Session({ workingDir: "/a", model: "gpt-4o", sandboxPolicy: "workspace-write" });
    await store.save(session);
    await store.delete(session.id);
    const loaded = await store.load(session.id);
    expect(loaded).toBeNull();
  });

  test("prune removes sessions beyond maxSessions", async () => {
    // Create 3 sessions with staggered timestamps
    const sessions: Session[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new Session({
        workingDir: "/tmp",
        model: "gpt-4o",
        sandboxPolicy: "workspace-write",
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      });
      s.setName(`session-${i}`);
      // Update lastActiveAt to control sort order (most recent first)
      s.lastActiveAt = new Date(2026, 0, i + 1).toISOString();
      await store.save(s);
      sessions.push(s);
    }

    await store.prune({ maxSessions: 2 });
    const list = await store.list();
    expect(list).toHaveLength(2);
    // Most recent 2 should remain (session-2 and session-1)
    const remainingNames = list.map(s => s.name).sort();
    expect(remainingNames).toEqual(["session-1", "session-2"]);
  });
});