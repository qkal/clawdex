import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/store.js";

describe("MemoryStore", () => {
  let dir: string;
  let store: MemoryStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-memories-"));
    store = new MemoryStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("add and list memories", async () => {
    await store.add({
      content: "User prefers TypeScript",
      source: "session-abc",
    });
    await store.add({
      content: "Project uses pnpm workspaces",
      source: "session-abc",
    });

    const memories = await store.list();
    expect(memories).toHaveLength(2);
    expect(memories.some((m) => m.content.includes("TypeScript"))).toBe(true);
  });

  test("get returns a specific memory by id", async () => {
    const entry = await store.add({
      content: "Important fact",
      source: "session-1",
    });
    const found = await store.get(entry.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe("Important fact");
  });

  test("get returns null for unknown id", async () => {
    expect(await store.get("nonexistent")).toBeNull();
  });

  test("remove deletes a memory", async () => {
    const entry = await store.add({
      content: "Temporary",
      source: "session-1",
    });
    await store.remove(entry.id);
    expect(await store.get(entry.id)).toBeNull();
  });

  test("clear removes all memories", async () => {
    await store.add({ content: "A", source: "s1" });
    await store.add({ content: "B", source: "s1" });
    await store.clear();
    const memories = await store.list();
    expect(memories).toHaveLength(0);
  });

  test("getSummary returns consolidated summary file", async () => {
    await store.writeSummary("This is the consolidated summary.");
    const summary = await store.getSummary();
    expect(summary).toBe("This is the consolidated summary.");
  });

  test("getSummary returns null when no summary exists", async () => {
    expect(await store.getSummary()).toBeNull();
  });
});
