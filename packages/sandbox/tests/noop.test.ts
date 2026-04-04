import { describe, expect, test } from "bun:test";
import { NoopSandbox } from "../src/noop";

describe("NoopSandbox", () => {
  test("allows all file reads", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkFileRead("/etc/passwd").allowed).toBe(true);
    expect(sandbox.checkFileRead("C:\\Windows\\System32").allowed).toBe(true);
  });

  test("allows all file writes", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkFileWrite("/home/user/file.txt").allowed).toBe(true);
  });

  test("allows all exec", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkExec("rm -rf /").allowed).toBe(true);
  });

  test("allows all network", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.checkNetwork("evil.com").allowed).toBe(true);
  });

  test("has danger-full-access policy", () => {
    const sandbox = new NoopSandbox();
    expect(sandbox.policy.type).toBe("danger-full-access");
    expect(sandbox.policy.networkAccess).toBe(true);
  });
});
