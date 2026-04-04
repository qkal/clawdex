import type {
  ISandbox,
  SandboxPolicy,
  SandboxCheckResult,
} from "@clawdex/shared-types";

export interface MockSandboxOptions {
  denyPatterns?: {
    fileRead?: string[];
    fileWrite?: string[];
    exec?: string[];
    network?: string[];
  };
}

/**
 * A configurable mock sandbox for testing.
 * By default, allows everything. Pass `denyPatterns` to selectively deny operations.
 */
export class MockSandbox implements ISandbox {
  readonly policy: SandboxPolicy = {
    type: "danger-full-access",
    writableRoots: [],
    networkAccess: true,
  };

  private readonly denyPatterns: Required<NonNullable<MockSandboxOptions["denyPatterns"]>>;

  constructor(options?: MockSandboxOptions) {
    this.denyPatterns = {
      fileRead: options?.denyPatterns?.fileRead ?? [],
      fileWrite: options?.denyPatterns?.fileWrite ?? [],
      exec: options?.denyPatterns?.exec ?? [],
      network: options?.denyPatterns?.network ?? [],
    };
  }

  checkFileRead(path: string): SandboxCheckResult {
    return this.check(path, this.denyPatterns.fileRead);
  }

  checkFileWrite(path: string): SandboxCheckResult {
    return this.check(path, this.denyPatterns.fileWrite);
  }

  checkExec(command: string): SandboxCheckResult {
    return this.check(command, this.denyPatterns.exec);
  }

  checkNetwork(host: string): SandboxCheckResult {
    return this.check(host, this.denyPatterns.network);
  }

  private check(value: string, patterns: string[]): SandboxCheckResult {
    for (const pattern of patterns) {
      if (value.includes(pattern)) {
        return { allowed: false, reason: `Denied by mock pattern: ${pattern}` };
      }
    }
    return { allowed: true };
  }
}
