import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TokenStore } from "../src/token-store.js";

describe("TokenStore", () => {
  let dir: string;
  let store: TokenStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-auth-"));
    store = new TokenStore(join(dir, "auth.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save and load round-trips tokens", async () => {
    await store.save({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: "2026-12-31T23:59:59Z",
      user: "testuser",
    });
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe("access-123");
    expect(loaded!.refreshToken).toBe("refresh-456");
    expect(loaded!.user).toBe("testuser");
  });

  test("load returns null when file does not exist", async () => {
    const loaded = await store.load();
    expect(loaded).toBeNull();
  });

  test("clear removes stored tokens", async () => {
    await store.save({
      accessToken: "a",
      refreshToken: "b",
      expiresAt: "2026-12-31T23:59:59Z",
    });
    await store.clear();
    const loaded = await store.load();
    expect(loaded).toBeNull();
  });

  test("isExpired returns true for past dates", () => {
    expect(store.isExpired("2020-01-01T00:00:00Z")).toBe(true);
  });

  test("isExpired returns false for future dates", () => {
    expect(store.isExpired("2030-01-01T00:00:00Z")).toBe(false);
  });

  test("isExpired returns false for undefined", () => {
    expect(store.isExpired(undefined)).toBe(false);
  });
});
