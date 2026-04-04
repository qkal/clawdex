import { describe, test, expect } from "bun:test";
import { NoopSandbox } from "../src/noop.js";

describe("NoopSandbox", () => {
  test("allows all reads", async () => {
    const sandbox = new NoopSandbox();
    expect((await sandbox.checkRead("/any/path")).allowed).toBe(true);
  });

  test("allows all writes", async () => {
    const sandbox = new NoopSandbox();
    expect((await sandbox.checkWrite("/any/path")).allowed).toBe(true);
  });

  test("allows all exec", async () => {
    const sandbox = new NoopSandbox();
    expect((await sandbox.checkExec("rm", ["-rf", "/"])).allowed).toBe(true);
  });

  test("allows all network", async () => {
    const sandbox = new NoopSandbox();
    expect((await sandbox.checkNetwork("evil.com", 443)).allowed).toBe(true);
  });
});
