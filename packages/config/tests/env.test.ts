import { describe, expect, test, afterEach } from "bun:test";
import { resolveEnvOverrides } from "../src/env";

describe("resolveEnvOverrides", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars touched by tests
    for (const key of ["CLAWDEX_MODEL", "CLAWDEX_PORT", "CLAWDEX_SANDBOX_MODE",
      "CLAWDEX_APPROVAL_POLICY", "CLAWDEX_BASE_URL", "CLAWDEX_HOST"]) {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("maps CLAWDEX_MODEL to model", () => {
    process.env.CLAWDEX_MODEL = "gpt-4o-mini";
    const overrides = resolveEnvOverrides();
    expect(overrides.model).toBe("gpt-4o-mini");
  });

  test("maps CLAWDEX_PORT to server.port", () => {
    process.env.CLAWDEX_PORT = "8080";
    const overrides = resolveEnvOverrides();
    expect((overrides.server as { port: number })?.port).toBe(8080);
  });

  test("maps CLAWDEX_SANDBOX_MODE to sandbox_mode", () => {
    process.env.CLAWDEX_SANDBOX_MODE = "read-only";
    const overrides = resolveEnvOverrides();
    expect(overrides.sandbox_mode).toBe("read-only");
  });

  test("maps CLAWDEX_APPROVAL_POLICY", () => {
    process.env.CLAWDEX_APPROVAL_POLICY = "never";
    const overrides = resolveEnvOverrides();
    expect(overrides.approval_policy).toBe("never");
  });

  test("maps CLAWDEX_BASE_URL to auth.base_url", () => {
    process.env.CLAWDEX_BASE_URL = "http://localhost:4000/v1";
    const overrides = resolveEnvOverrides();
    expect((overrides.auth as { base_url: string })?.base_url).toBe("http://localhost:4000/v1");
  });

  test("maps CLAWDEX_HOST to server.host", () => {
    process.env.CLAWDEX_HOST = "0.0.0.0";
    const overrides = resolveEnvOverrides();
    expect((overrides.server as { host: string })?.host).toBe("0.0.0.0");
  });

  test("returns empty object when no env vars set", () => {
    delete process.env.CLAWDEX_MODEL;
    delete process.env.CLAWDEX_PORT;
    delete process.env.CLAWDEX_SANDBOX_MODE;
    delete process.env.CLAWDEX_APPROVAL_POLICY;
    delete process.env.CLAWDEX_BASE_URL;
    delete process.env.CLAWDEX_HOST;
    const overrides = resolveEnvOverrides();
    expect(Object.keys(overrides).length).toBe(0);
  });
});