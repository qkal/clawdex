import { describe, expect, test } from "bun:test";
import {
  ClawdexError,
  AuthError,
  ConfigError,
  SessionError,
  ToolError,
  SandboxError,
  ProtocolError,
} from "../src/errors";

describe("ClawdexError", () => {
  test("is an instance of Error", () => {
    const err = new ClawdexError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.message).toBe("test");
    expect(err.name).toBe("ClawdexError");
  });

  test("supports error code", () => {
    const err = new ClawdexError("test", "INTERNAL_ERROR");
    expect(err.code).toBe("INTERNAL_ERROR");
  });
});

describe("AuthError", () => {
  test("extends ClawdexError", () => {
    const err = new AuthError("no key");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.name).toBe("AuthError");
    expect(err.code).toBe("AUTH_REQUIRED");
  });
});

describe("ConfigError", () => {
  test("includes path to invalid config", () => {
    const err = new ConfigError("bad value", "/home/.clawdex/config.toml");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.configPath).toBe("/home/.clawdex/config.toml");
  });
});

describe("ToolError", () => {
  test("includes tool name", () => {
    const err = new ToolError("failed", "shell");
    expect(err.toolName).toBe("shell");
  });
});

describe("derived errors", () => {
  test("SessionError", () => {
    const err = new SessionError("not found", "SESSION_NOT_FOUND");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("SandboxError", () => {
    const err = new SandboxError("permission denied");
    expect(err).toBeInstanceOf(ClawdexError);
  });

  test("ProtocolError", () => {
    const err = new ProtocolError("invalid submission", "INVALID_SUBMISSION");
    expect(err).toBeInstanceOf(ClawdexError);
    expect(err.code).toBe("INVALID_SUBMISSION");
  });
});
