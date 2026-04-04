import type {
  ISandbox,
  SandboxCheckResult,
  SandboxPolicy,
} from "@clawdex/shared-types";
import { resolve, normalize } from "node:path";

export interface LinuxSandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

/**
 * Linux sandbox implementation.
 *
 * Phase 8 MVP: path-based access control (checking paths against writable roots).
 * Future: Landlock LSM syscalls for kernel-enforced filesystem access control.
 *
 * Path normalization is case-sensitive (Linux filesystems are case-sensitive).
 * All roots and checked paths are resolved to absolute, normalized form.
 */
export class LinuxSandbox implements ISandbox {
  readonly policy: SandboxPolicy;
  private readonly writableRoots: string[];
  private readonly networkAccess: boolean;

  constructor(opts: LinuxSandboxOptions) {
    this.writableRoots = opts.writableRoots.map((r) => normalize(resolve(r)));
    this.networkAccess = opts.networkAccess;
    this.policy = {
      type: "workspace-write",
      writableRoots: this.writableRoots,
      networkAccess: this.networkAccess,
    };
  }

  checkFileRead(_path: string): SandboxCheckResult {
    // Read access is always allowed — tools need unrestricted read
    // access to inspect the filesystem and project files.
    return { allowed: true };
  }

  checkFileWrite(path: string): SandboxCheckResult {
    const normalizedPath = normalize(resolve(path));

    for (const root of this.writableRoots) {
      // Ensure the path is inside the root directory (prefix + separator check).
      // A path of "/home/user/project-other/file" must NOT match root "/home/user/project".
      if (
        normalizedPath === root ||
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

  checkExec(
    _command: string,
    _args?: string[],
  ): SandboxCheckResult {
    // For MVP, allow all exec — the approval policy handles dangerous commands.
    // Future: Landlock can restrict which executables can be spawned.
    return { allowed: true };
  }

  checkNetwork(
    host: string,
    _port?: number,
  ): SandboxCheckResult {
    if (this.networkAccess) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Network access denied: sandbox policy blocks connections to ${host}`,
    };
  }

  // Back-compat helpers for older call sites/tests.
  checkRead(path: string): SandboxCheckResult {
    return this.checkFileRead(path);
  }

  checkWrite(path: string): SandboxCheckResult {
    return this.checkFileWrite(path);
  }
}
