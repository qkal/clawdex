export type SandboxPolicyType =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export interface SandboxPolicy {
  type: SandboxPolicyType;
  writableRoots: string[];
  networkAccess: boolean;
}

export interface SandboxCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ISandbox {
  readonly policy: SandboxPolicy;
  checkFileRead(path: string): SandboxCheckResult;
  checkFileWrite(path: string): SandboxCheckResult;
  checkExec(command: string): SandboxCheckResult;
  checkNetwork(host: string): SandboxCheckResult;
}
