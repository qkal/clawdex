import { readFile, writeFile, unlink } from "node:fs/promises";

export interface LockFileData {
  pid: number;
  host: string;
  port: number;
  token: string;
  cwd: string;
  startedAt: string;
}

export async function writeLockFile(
  path: string,
  data: LockFileData,
): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

export async function readLockFile(
  path: string,
): Promise<LockFileData | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
}

export async function removeLockFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already removed
  }
}

/** Check if a lock file's PID is still running. */
export function isLockFileStale(data: LockFileData): boolean {
  try {
    // process.kill(pid, 0) throws if process doesn't exist
    process.kill(data.pid, 0);
    return false; // Process is alive
  } catch {
    return true; // Process is dead
  }
}
