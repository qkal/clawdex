// ─── Sandbox Types ───────────────────────────────────────────────

export type SandboxPolicyType = "read-only" | "workspace-write" | "danger-full-access";

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

// ─── Tool Types ──────────────────────────────────────────────────

export interface ToolSchema {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

export interface ToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  output: string;
  success: boolean;
  durationMs?: number;
  exitCode?: number;
}

export interface ToolContext {
  workingDir: string;
  sandbox: ISandbox;
}

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolSchema;
  execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult>;
}
