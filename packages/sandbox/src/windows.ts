import type { ISandbox, SandboxCheckResult } from "@clawdex/shared-types";
import { resolve, normalize } from "node:path";

export interface WindowsSandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

/**
 * Windows sandbox implementation.
 *
 * Phase 8 MVP: path-based access control (checking paths against writable roots).
 * Future: Job Objects for process containment, NTFS ACLs for filesystem enforcement.
 *
 * Path normalization uses lowercase comparison since Windows paths are
 * case-insensitive. All roots and checked paths are resolved to absolute,
 * normalized, lowercase form before comparison.
 */
export class WindowsSandbox implements ISandbox {
  private readonly writableRoots: string[];
  private readonly networkAccess: boolean;

  constructor(opts: WindowsSandboxOptions) {
    // Normalize all roots to lowercase for case-insensitive comparison.
    // On Windows, resolve() and normalize() produce backslash paths.
    this.writableRoots = opts.writableRoots.map((r) =>
      normalize(resolve(r)).toLowerCase(),
    );
    this.networkAccess = opts.networkAccess;
  }

  async checkRead(_path: string): Promise<SandboxCheckResult> {
    // Read access is always allowed — even in workspace-write mode,
    // reads are unrestricted so tools can inspect the filesystem.
    return { allowed: true };
  }

  async checkWrite(path: string): Promise<SandboxCheckResult> {
    const normalizedPath = normalize(resolve(path)).toLowerCase();

    for (const root of this.writableRoots) {
      // Ensure the path is inside the root directory (prefix + separator check).
      // A path of "C:\project-other\file" must NOT match root "C:\project".
      if (
        normalizedPath === root ||
        normalizedPath.startsWith(root + "\\") ||
        normalizedPath.startsWith(root + "/")
      ) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Write denied: ${path} is outside allowed writable roots`,
    };
  }

  async checkExec(
    _command: string,
    _args: string[],
  ): Promise<SandboxCheckResult> {
    // For MVP, allow all exec — the approval policy handles dangerous commands.
    // Future: restrict to allowed executables list via Job Objects.
    return { allowed: true };
  }

  async checkNetwork(
    host: string,
    _port: number,
  ): Promise<SandboxCheckResult> {
    if (this.networkAccess) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Network access denied: sandbox policy blocks connections to ${host}`,
    };
  }
}
