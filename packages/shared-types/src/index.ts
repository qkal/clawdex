/**
 * @clawdex/shared-types — cross-package contracts
 *
 * STUB: This is a minimal stub created during Phase 8 implementation.
 * The full shared-types package (Phase 1) would contain all interfaces,
 * error classes, WS protocol messages, config schema types, etc.
 * Only the types needed for sandbox backends are defined here.
 */

// ─── Sandbox ────────────────────────────────────────────────────────

/** Result from a sandbox permission check. */
export interface SandboxCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Sandbox interface — all sandbox backends must implement this.
 * Core creates the appropriate sandbox based on platform + config
 * and injects it into tools.
 */
export interface ISandbox {
  /** Check if reading the given path is allowed. */
  checkRead(path: string): Promise<SandboxCheckResult>;

  /** Check if writing to the given path is allowed. */
  checkWrite(path: string): Promise<SandboxCheckResult>;

  /** Check if executing the given command is allowed. */
  checkExec(command: string, args: string[]): Promise<SandboxCheckResult>;

  /** Check if network access to the given host/port is allowed. */
  checkNetwork(host: string, port: number): Promise<SandboxCheckResult>;
}

// ─── Tool ───────────────────────────────────────────────────────────

/** Tool interface — all built-in and MCP tools implement this. */
export interface ITool {
  name: string;
  description: string;
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult>;
}

export interface ToolContext {
  workingDir: string;
  sandbox: ISandbox;
}

export interface ToolResult {
  output: string;
  success: boolean;
}

// ─── Auth ───────────────────────────────────────────────────────────

export interface IAuthProvider {
  getToken(): Promise<string>;
  isAuthenticated(): boolean;
}

// ─── Errors ─────────────────────────────────────────────────────────

export class ClawdexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fatal: boolean = false,
  ) {
    super(message);
    this.name = "ClawdexError";
  }
}
