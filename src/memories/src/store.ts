import { mkdir, readdir, readFile, writeFile, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { MemoryEntry } from "./types.js";

export class MemoryStore {
  private readonly memoriesDir: string;
  private readonly summaryPath: string;

  constructor(baseDir: string) {
    this.memoriesDir = join(baseDir, "entries");
    this.summaryPath = join(baseDir, "memory_summary.md");
  }

  private entryPath(id: string): string {
    return join(this.memoriesDir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.memoriesDir, { recursive: true });
  }

  async add(opts: {
    content: string;
    source: string;
    tags?: string[];
  }): Promise<MemoryEntry> {
    await this.ensureDir();
    const entry: MemoryEntry = {
      id: randomUUID().slice(0, 12),
      content: opts.content,
      source: opts.source,
      createdAt: new Date().toISOString(),
      tags: opts.tags,
    };
    await writeFile(
      this.entryPath(entry.id),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
    return entry;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    try {
      const raw = await readFile(this.entryPath(id), "utf-8");
      return JSON.parse(raw) as MemoryEntry;
    } catch {
      return null;
    }
  }

  async list(): Promise<MemoryEntry[]> {
    await this.ensureDir();
    const files = await readdir(this.memoriesDir);
    const entries: MemoryEntry[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.memoriesDir, file), "utf-8");
        entries.push(JSON.parse(raw));
      } catch {
        // Skip corrupted entries
      }
    }

    // Sort oldest first (chronological order)
    return entries.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async remove(id: string): Promise<void> {
    try {
      await unlink(this.entryPath(id));
    } catch {
      // Already removed
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.memoriesDir, { recursive: true, force: true });
    } catch {
      // Already empty
    }
  }

  async writeSummary(summary: string): Promise<void> {
    // Ensure the parent directory of summaryPath exists
    const parentDir = join(this.summaryPath, "..");
    await mkdir(parentDir, { recursive: true });
    await writeFile(this.summaryPath, summary, "utf-8");
  }

  async getSummary(): Promise<string | null> {
    try {
      return await readFile(this.summaryPath, "utf-8");
    } catch {
      return null;
    }
  }
}
