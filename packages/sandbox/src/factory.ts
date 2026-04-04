import type { ISandbox, SandboxPolicyType } from "@clawdex/shared-types";
import { NoopSandbox } from "./noop";

export interface SandboxOptions {
  writableRoots: string[];
  networkAccess: boolean;
}

export function createSandbox(_policyType: SandboxPolicyType, _options: SandboxOptions): ISandbox {
  // MVP: all policies use NoopSandbox. Platform backends (Windows, Linux)
  // will be implemented in Phase 8.
  return new NoopSandbox();
}
