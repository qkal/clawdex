import type { ISandbox, SandboxPolicy, SandboxCheckResult } from "@clawdex/shared-types";

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

  checkExec(_command: string): SandboxCheckResult {
    return { allowed: true };
  }

  checkNetwork(_host: string): SandboxCheckResult {
    return { allowed: true };
  }
}
