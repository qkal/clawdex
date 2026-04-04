import type { ISandbox } from "@clawdex/shared-types";
import { LinuxSandbox } from "./linux.js";
import { NoopSandbox } from "./noop.js";
import { WindowsSandbox } from "./windows.js";

export interface SandboxFactoryOptions {
  mode: "read-only" | "workspace-write" | "danger-full-access";
  writableRoots?: string[];
  networkAccess?: boolean;
}

/**
 * Create a sandbox instance based on the sandbox mode and current platform.
 *
 * - "danger-full-access" always returns NoopSandbox (no restrictions).
 * - "read-only" and "workspace-write" return platform-specific backends:
 *   - win32  → WindowsSandbox (path-based ACLs, future: Job Objects)
 *   - linux  → LinuxSandbox (path-based checks, future: Landlock LSM)
 *   - other  → NoopSandbox (unsupported platforms fall back to no enforcement)
 *
 * The factory uses dynamic imports so platform-specific modules are only
 * loaded on the platform that needs them.
 */
export function createSandbox(
  modeOrOpts: string | SandboxFactoryOptions,
): ISandbox {
  const opts: SandboxFactoryOptions =
    typeof modeOrOpts === "string"
      ? { mode: modeOrOpts as SandboxFactoryOptions["mode"] }
      : modeOrOpts;

  // Full access mode skips all sandboxing
  if (opts.mode === "danger-full-access") {
    return new NoopSandbox();
  }

  const writableRoots = opts.writableRoots ?? [process.cwd()];
  const networkAccess = opts.networkAccess ?? false;

  if (process.platform === "win32") {
    return new WindowsSandbox({ writableRoots, networkAccess });
  }

  if (process.platform === "linux") {
    return new LinuxSandbox({ writableRoots, networkAccess });
  }

  // Unsupported platforms (macOS, etc.) fall back to NoopSandbox.
  // macOS support (Seatbelt) is deferred post-MVP.
  return new NoopSandbox();
}
