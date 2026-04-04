import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: string;
}

export class TokenStore {
  constructor(private readonly filePath: string) {}

  async save(tokens: StoredTokens): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(tokens, null, 2), {
      encoding: "utf-8",
      mode: 0o600, // restrictive permissions
    });
  }

  async load(): Promise<StoredTokens | null> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as StoredTokens;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch {
      // Already gone
    }
  }

  /** Check if a token expiry date is in the past. */
  isExpired(expiresAt: string | undefined): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }
}
