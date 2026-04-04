export type ErrorCode =
  | "TURN_IN_PROGRESS"
  | "SESSION_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "INVALID_MODEL"
  | "INVALID_SUBMISSION"
  | "INTERNAL_ERROR";

export class ClawdexError extends Error {
  readonly code?: ErrorCode;

  constructor(message: string, code?: ErrorCode) {
    super(message);
    this.name = "ClawdexError";
    this.code = code;
  }
}

export class AuthError extends ClawdexError {
  constructor(message: string, code?: ErrorCode) {
    super(message, code ?? "AUTH_REQUIRED");
    this.name = "AuthError";
  }
}

export class ConfigError extends ClawdexError {
  readonly configPath?: string;

  constructor(message: string, configPath?: string) {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
  }
}

export class SessionError extends ClawdexError {
  constructor(message: string, code?: ErrorCode) {
    super(message, code);
    this.name = "SessionError";
  }
}

export class ToolError extends ClawdexError {
  readonly toolName: string;

  constructor(message: string, toolName: string) {
    super(message);
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class SandboxError extends ClawdexError {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

export class ProtocolError extends ClawdexError {
  constructor(message: string, code?: ErrorCode) {
    super(message, code);
    this.name = "ProtocolError";
  }
}