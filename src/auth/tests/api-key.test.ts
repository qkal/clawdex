import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { ApiKeyAuthProvider } from "../src/api-key.js";
import { AuthError } from "@clawdex/shared-types";

describe("ApiKeyAuthProvider", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.MY_KEY = process.env.MY_KEY;
    savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    savedEnv.MISSING_KEY = process.env.MISSING_KEY;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  test("reads API key from specified env var", async () => {
    process.env.MY_KEY = "sk-test-123";
    const provider = new ApiKeyAuthProvider("MY_KEY");
    const token = await provider.getToken();
    expect(token.token).toBe("sk-test-123");
    expect(token.expiresAt).toBeUndefined();
  });

  test("reports authenticated status", async () => {
    process.env.OPENAI_API_KEY = "sk-test-456";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(true);
    expect(status.method).toBe("api_key");
  });

  test("throws AuthError when key is missing", async () => {
    delete process.env.MISSING_KEY;
    const provider = new ApiKeyAuthProvider("MISSING_KEY");
    await expect(provider.getToken()).rejects.toThrow(AuthError);
  });

  test("reports unauthenticated when key is missing", async () => {
    delete process.env.MISSING_KEY;
    const provider = new ApiKeyAuthProvider("MISSING_KEY");
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });

  test("refresh returns same key", async () => {
    process.env.OPENAI_API_KEY = "sk-test-789";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    const token = await provider.refresh();
    expect(token.token).toBe("sk-test-789");
  });

  test("logout is a no-op for API key auth", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const provider = new ApiKeyAuthProvider("OPENAI_API_KEY");
    await expect(provider.logout()).resolves.toBeUndefined();
  });
});
