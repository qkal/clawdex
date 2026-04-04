import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeLockFile,
  readLockFile,
  removeLockFile,
  isLockFileStale,
  type LockFileData,
} from "../src/lock-file.js";

describe("lock file", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-lock-"));
    lockPath = join(dir, "server.lock");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("write and read round-trips", async () => {
    const data: LockFileData = {
      pid: process.pid,
      host: "127.0.0.1",
      port: 3141,
      token: "test-token",
      cwd: "/tmp/project",
      startedAt: new Date().toISOString(),
    };
    await writeLockFile(lockPath, data);
    const read = await readLockFile(lockPath);
    expect(read).toEqual(data);
  });

  test("readLockFile returns null for missing file", async () => {
    const read = await readLockFile(join(dir, "nonexistent.lock"));
    expect(read).toBeNull();
  });

  test("removeLockFile deletes the file", async () => {
    await writeLockFile(lockPath, {
      pid: 1234,
      host: "127.0.0.1",
      port: 3141,
      token: "t",
      cwd: "/",
      startedAt: new Date().toISOString(),
    });
    await removeLockFile(lockPath);
    const read = await readLockFile(lockPath);
    expect(read).toBeNull();
  });

  test("isLockFileStale returns true for dead PID", () => {
    // PID 999999 is almost certainly not running
    expect(isLockFileStale({ pid: 999999 } as LockFileData)).toBe(true);
  });

  test("isLockFileStale returns false for current process PID", () => {
    expect(isLockFileStale({ pid: process.pid } as LockFileData)).toBe(false);
  });
});
