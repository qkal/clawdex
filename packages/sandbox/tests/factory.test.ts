import { describe, test, expect } from "bun:test";
import { createSandbox } from "../src/factory.js";
import { NoopSandbox } from "../src/noop.js";
import { WindowsSandbox } from "../src/windows.js";
import { LinuxSandbox } from "../src/linux.js";

describe("createSandbox", () => {
  test("danger-full-access returns NoopSandbox", () => {
    const sandbox = createSandbox("danger-full-access");
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });

  test("danger-full-access with options object returns NoopSandbox", () => {
    const sandbox = createSandbox({
      mode: "danger-full-access",
      writableRoots: ["/some/path"],
      networkAccess: true,
    });
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });

  test("workspace-write returns platform-specific sandbox", () => {
    const sandbox = createSandbox({
      mode: "workspace-write",
      writableRoots: [process.cwd()],
      networkAccess: false,
    });

    if (process.platform === "win32") {
      expect(sandbox).toBeInstanceOf(WindowsSandbox);
    } else if (process.platform === "linux") {
      expect(sandbox).toBeInstanceOf(LinuxSandbox);
    } else {
      // macOS and other unsupported platforms fall back to NoopSandbox
      expect(sandbox).toBeInstanceOf(NoopSandbox);
    }
  });

  test("read-only returns platform-specific sandbox", () => {
    const sandbox = createSandbox({
      mode: "read-only",
      writableRoots: [],
      networkAccess: false,
    });

    if (process.platform === "win32") {
      expect(sandbox).toBeInstanceOf(WindowsSandbox);
    } else if (process.platform === "linux") {
      expect(sandbox).toBeInstanceOf(LinuxSandbox);
    } else {
      expect(sandbox).toBeInstanceOf(NoopSandbox);
    }
  });

  test("string mode argument works", () => {
    const sandbox = createSandbox("workspace-write");

    // Should not throw and should return a valid sandbox
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.checkRead).toBe("function");
    expect(typeof sandbox.checkWrite).toBe("function");
    expect(typeof sandbox.checkExec).toBe("function");
    expect(typeof sandbox.checkNetwork).toBe("function");
  });

  test("defaults writableRoots to cwd and networkAccess to false", async () => {
    const sandbox = createSandbox("workspace-write");

    // On Windows/Linux, it should use cwd as writable root
    if (process.platform === "win32" || process.platform === "linux") {
      // Writing within cwd should be allowed
      const withinCwd = await sandbox.checkWrite(
        process.cwd() + "/test-file.txt",
      );
      expect(withinCwd.allowed).toBe(true);

      // Network should be denied by default
      const network = await sandbox.checkNetwork("example.com", 443);
      expect(network.allowed).toBe(false);
    }
  });

  test("workspace-write sandbox enforces write restrictions", async () => {
    const sandbox = createSandbox({
      mode: "workspace-write",
      writableRoots: [process.cwd()],
      networkAccess: false,
    });

    if (process.platform === "win32" || process.platform === "linux") {
      // Read is always allowed
      const read = await sandbox.checkRead("/etc/passwd");
      expect(read.allowed).toBe(true);

      // Write within root is allowed
      const writeIn = await sandbox.checkWrite(
        process.cwd() + "/file.txt",
      );
      expect(writeIn.allowed).toBe(true);

      // Write outside root is denied
      const sep = process.platform === "win32" ? "\\" : "/";
      const outsidePath =
        process.platform === "win32"
          ? "C:\\Windows\\System32\\evil.dll"
          : "/tmp/evil.sh";
      const writeOut = await sandbox.checkWrite(outsidePath);
      expect(writeOut.allowed).toBe(false);
    }
  });
});
