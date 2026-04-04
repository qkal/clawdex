import { describe, test, expect } from "bun:test";
import { WindowsSandbox } from "../src/windows.js";

// Skip on non-Windows platforms
const isWindows = process.platform === "win32";
const describeWindows = isWindows ? describe : describe.skip;

describeWindows("WindowsSandbox", () => {
  test("checkWrite allows paths within writable roots", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite(
      "C:\\Users\\test\\project\\src\\file.ts",
    );
    expect(result.allowed).toBe(true);
  });

  test("checkWrite allows the root path itself", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("C:\\Users\\test\\project");
    expect(result.allowed).toBe(true);
  });

  test("checkWrite denies paths outside writable roots", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite("C:\\Windows\\System32\\config");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test("checkWrite denies paths with similar prefix but different directory", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\test\\project"],
      networkAccess: false,
    });
    // "project-other" starts with "project" but is a different directory
    const result = await sandbox.checkWrite(
      "C:\\Users\\test\\project-other\\file.ts",
    );
    expect(result.allowed).toBe(false);
  });

  test("checkWrite is case-insensitive on Windows", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\Users\\Test\\Project"],
      networkAccess: false,
    });
    const result = await sandbox.checkWrite(
      "c:\\users\\test\\project\\src\\file.ts",
    );
    expect(result.allowed).toBe(true);
  });

  test("checkWrite with multiple writable roots", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\project-a", "C:\\project-b"],
      networkAccess: false,
    });
    expect(
      (await sandbox.checkWrite("C:\\project-a\\file.ts")).allowed,
    ).toBe(true);
    expect(
      (await sandbox.checkWrite("C:\\project-b\\file.ts")).allowed,
    ).toBe(true);
    expect(
      (await sandbox.checkWrite("C:\\project-c\\file.ts")).allowed,
    ).toBe(false);
  });

  test("checkRead allows any path in workspace-write mode", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkRead("C:\\anywhere\\file.txt");
    expect(result.allowed).toBe(true);
  });

  test("checkExec allows commands (approval policy handles restrictions)", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: ["C:\\project"],
      networkAccess: false,
    });
    const result = await sandbox.checkExec("cmd.exe", ["/c", "echo", "hello"]);
    expect(result.allowed).toBe(true);
  });

  test("checkNetwork denies when networkAccess is false", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: [],
      networkAccess: false,
    });
    const result = await sandbox.checkNetwork("example.com", 443);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("example.com");
  });

  test("checkNetwork allows when networkAccess is true", async () => {
    const sandbox = new WindowsSandbox({
      writableRoots: [],
      networkAccess: true,
    });
    const result = await sandbox.checkNetwork("example.com", 443);
    expect(result.allowed).toBe(true);
  });
});
