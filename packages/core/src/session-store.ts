import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Session } from "./session.js";
import type { SessionFile } from "./types.js";
import type { SessionSummary } from "@clawdex/shared-types";

export class SessionStore {
  constructor(private readonly dir: string) {}

  /** Ensure the sessions directory exists. */
  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  /** Persist a session to disk using atomic write (write tmp, rename). */
  async save(session: Session): Promise<void> {
    await this.ensureDir();
    const file: SessionFile = {
      version: 1,
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      workingDir: session.workingDir,
      model: session.model,
      sandboxPolicy: session.sandboxPolicy,
      messages: [...session.messages],
      tokenUsage: session.tokenUsage,
      diffs: [...session.diffs],
    };
    const json = JSON.stringify(file, null, 2);
    const tmpPath = this.filePath(session.id) + ".tmp";
    await writeFile(tmpPath, json, "utf-8");
    // Atomic rename
    const { rename } = await import("node:fs/promises");
    await rename(tmpPath, this.filePath(session.id));
  }

  /** Load a session from disk. Returns null if not found. */
  async load(id: string): Promise<Session | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf-8");
      const file: SessionFile = JSON.parse(raw);
      const session = new Session({
        id: file.id,
        workingDir: file.workingDir,
        model: file.model,
        sandboxPolicy: file.sandboxPolicy,
        name: file.name,
        createdAt: file.createdAt,
      });
      for (const msg of file.messages) {
        session.addMessage(msg);
      }
      // Restore the persisted lastActiveAt after hydrating messages,
      // so that addMessage() timestamp side-effects are overwritten.
      session.lastActiveAt = file.lastActiveAt;
      if (file.tokenUsage) {
        session.addTokenUsage(file.tokenUsage);
      }
      if (file.diffs) {
        session.addDiffs(file.diffs);
      }
      return session;
    } catch {
      return null;
    }
  }

  /** List summaries of all sessions on disk. */
  async list(): Promise<SessionSummary[]> {
    await this.ensureDir();
    const files = await readdir(this.dir);
    const summaries: SessionSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.dir, file), "utf-8");
        const data: SessionFile = JSON.parse(raw);
        summaries.push({
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          lastActiveAt: data.lastActiveAt,
          messageCount: data.messages.length,
          workingDir: data.workingDir,
        });
      } catch {
        // Skip corrupted files
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  /** Delete a session file from disk. */
  async delete(id: string): Promise<void> {
    try {
      await unlink(this.filePath(id));
    } catch {
      // Already deleted or never existed
    }
  }

  /** Prune old sessions beyond limits. Keeps most recent. */
  async prune(opts: { maxSessions?: number; maxAgeDays?: number }): Promise<void> {
    const summaries = await this.list();

    // Filter by age first
    if (opts.maxAgeDays !== undefined) {
      const cutoff = Date.now() - opts.maxAgeDays * 86_400_000;
      for (const s of summaries) {
        if (new Date(s.lastActiveAt).getTime() < cutoff) {
          await this.delete(s.id);
        }
      }
    }

    // Then enforce max count (list is already sorted by lastActiveAt desc)
    if (opts.maxSessions !== undefined) {
      const remaining = await this.list();
      if (remaining.length > opts.maxSessions) {
        const toDelete = remaining.slice(opts.maxSessions);
        for (const s of toDelete) {
          await this.delete(s.id);
        }
      }
    }
  }
}
