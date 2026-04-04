import type {
  ISandbox,
  SandboxCheckResult,
  SandboxPolicy,
} from "@clawdex/shared-types";

/**
 * NoopSandbox — allows everything. Used for development and
 * "danger-full-access" mode.
 */
export class NoopSandbox implements ISandbox {
  readonly policy: SandboxPolicy = {
    type: "danger-full-access",
    writableRoots: [],
    networkAccess: true,
  };

  checkFileRead(_path: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkFileWrite(_path: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkExec(
    _command: string,
    _args?: string[],
  ): SandboxCheckResult {
    return { allowed: true };
  }

  checkNetwork(
    _host: string,
    _port?: number,
  ): SandboxCheckResult {
    return { allowed: true };
  }

  // Back-compat helpers for older call sites/tests.
  checkRead(path: string): SandboxCheckResult {
    return this.checkFileRead(path);
  }

  checkWrite(path: string): SandboxCheckResult {
    return this.checkFileWrite(path);
  }
}
