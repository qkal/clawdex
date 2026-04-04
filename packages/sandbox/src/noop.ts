import type { ISandbox, SandboxCheckResult } from "@clawdex/shared-types";

/**
 * NoopSandbox — allows everything. Used for development and
 * "danger-full-access" mode.
 */
export class NoopSandbox implements ISandbox {
  async checkRead(_path: string): Promise<SandboxCheckResult> {
    return { allowed: true };
  }

  async checkWrite(_path: string): Promise<SandboxCheckResult> {
    return { allowed: true };
  }

  async checkExec(
    _command: string,
    _args: string[],
  ): Promise<SandboxCheckResult> {
    return { allowed: true };
  }

  async checkNetwork(
    _host: string,
    _port: number,
  ): Promise<SandboxCheckResult> {
    return { allowed: true };
  }
}
