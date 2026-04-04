import { describe, test, expect } from "bun:test";
import { LinuxSandbox } from "../src/linux.js";

// Skip on non-Linux platforms
const isLinux = process.platform === "linux";
const describeLinux = isLinux ? describe : describe.skip;

describeLinux("LinuxSandbox", () => {
  test("checkWrite allows paths within writable roots", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite(
      "/home/user/project/src/file.ts",
    );
    expect(result.allowed).toBe(true);
  });

  test("checkWrite allows the root path itself", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("/home/user/project");
    expect(result.allowed).toBe(true);
  });

  test("checkWrite denies paths outside writable roots", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("/etc/passwd");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("checkWrite denies paths with similar prefix but different directory", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/project"],
      networkAccess: false,
    });
    // "project-other" starts with "project" but is a different directory
    const result = await sandbox.checkWrite(
      "/home/user/project-other/file.ts",
    );
    expect(result.allowed).toBe(false);
  });

  test("checkWrite is case-sensitive on Linux", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/home/user/Project"],
      networkAccess: false,
    });
    // Lowercase "project" should NOT match uppercase "Project"
    const result = await sandbox.checkWrite(
      "/home/user/project/src/file.ts",
    );
    expect(result.allowed).toBe(false);
  });

  test("checkWrite with multiple writable roots", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/project-a", "/project-b"],
      networkAccess: false,
    });
    expect(
      (await sandbox.checkWrite("/project-a/file.ts")).allowed,
    ).toBe(true);
    expect(
      (await sandbox.checkWrite("/project-b/file.ts")).allowed,
    ).toBe(true);
    expect(
      (await sandbox.checkWrite("/project-c/file.ts")).allowed,
    ).toBe(false);
  });

  test("checkRead allows any path", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkRead("/etc/hostname");
    expect(result.allowed).toBe(true);
  });

  test("checkExec allows commands (approval policy handles restrictions)", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: ["/project"],
      networkAccess: false,
    });
    const result = await sandbox.checkExec("bash", ["-c", "echo hello"]);
    expect(result.allowed).toBe(true);
  });

  test("checkNetwork denies when networkAccess is false", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: [],
      networkAccess: false,
    });
    const result = await sandbox.checkNetwork("example.com", 443);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("example.com");
  });

  test("checkNetwork allows when networkAccess is true", async () => {
    const sandbox = new LinuxSandbox({
      writableRoots: [],
      networkAccess: true,
    });
    const result = await sandbox.checkNetwork("example.com", 443);
    expect(result.allowed).toBe(true);
  });
});
