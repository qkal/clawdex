import { describe, test, expect } from "bun:test";
import { validateToken, extractTokenFromUrl, extractTokenFromHeader } from "../src/auth-guard.js";

describe("validateToken", () => {
  test("returns true for matching token", () => {
    expect(validateToken("abc123", "abc123")).toBe(true);
  });

  test("returns false for mismatched token", () => {
    expect(validateToken("abc123", "wrong")).toBe(false);
  });

  test("returns false for empty token", () => {
    expect(validateToken("abc123", "")).toBe(false);
    expect(validateToken("abc123", undefined)).toBe(false);
  });

  test("returns false when expected is empty", () => {
    expect(validateToken("", "abc")).toBe(false);
  });

  test("returns false for different length tokens", () => {
    expect(validateToken("short", "longerthan")).toBe(false);
  });
});

describe("extractTokenFromUrl", () => {
  test("extracts token query parameter", () => {
    const url = "http://localhost:3141/?token=mytoken123";
    expect(extractTokenFromUrl(url)).toBe("mytoken123");
  });

  test("returns null when no token param", () => {
    expect(extractTokenFromUrl("http://localhost:3141/")).toBeNull();
  });

  test("extracts token with other params", () => {
    const url = "http://localhost:3141/?foo=bar&token=mytoken123&baz=qux";
    expect(extractTokenFromUrl(url)).toBe("mytoken123");
  });

  test("returns null for invalid URL", () => {
    expect(extractTokenFromUrl("not-a-url")).toBeNull();
  });
});

describe("extractTokenFromHeader", () => {
  test("extracts Bearer token", () => {
    expect(extractTokenFromHeader("Bearer mytoken123")).toBe("mytoken123");
  });

  test("is case-insensitive on Bearer prefix", () => {
    expect(extractTokenFromHeader("bearer mytoken123")).toBe("mytoken123");
    expect(extractTokenFromHeader("BEARER mytoken123")).toBe("mytoken123");
  });

  test("returns null for non-Bearer auth", () => {
    expect(extractTokenFromHeader("Basic abc")).toBeNull();
  });

  test("returns null for missing header", () => {
    expect(extractTokenFromHeader(undefined)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(extractTokenFromHeader("")).toBeNull();
  });
});
