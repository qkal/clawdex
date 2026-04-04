// ============================================================
// @clawdex/shared-types — All cross-package contracts
// Stub for Phase 4 (Server + Web). Full implementation in Phase 1.
// ============================================================

// --- WebSocket Protocol Types ---

export type Submission = {
  id: string;
  op: Op;
};

export type Op =
  // Turn lifecycle
  | { type: "user_turn"; prompt: string; sessionId: string; model?: string; effort?: "low" | "medium" | "high" }
  | { type: "interrupt" }
  | { type: "undo" }
  | { type: "compact" }
  | { type: "shutdown" }
  // Approvals
  | { type: "exec_approval"; callId: string; decision: "approve" | "deny"; reason?: string }
  | { type: "patch_approval"; callId: string; decision: "approve" | "deny" }
  | { type: "mcp_elicitation_response"; requestId: string; serverName: string; decision: "approve" | "deny"; content?: unknown }
  // Session management
  | { type: "create_session"; workingDir?: string; name?: string }
  | { type: "load_session"; sessionId: string }
  | { type: "delete_session"; sessionId: string }
  | { type: "set_session_name"; sessionId: string; name: string }
  | { type: "list_sessions" }
  // Direct shell
  | { type: "run_user_shell_command"; command: string }
  // Models
  | { type: "list_models" }
  // MCP
  | { type: "list_mcp_tools" }
  | { type: "refresh_mcp_servers" }
  // Skills
  | { type: "list_skills"; workingDirs?: string[] }
  // Memories
  | { type: "update_memories" }
  | { type: "drop_memories" }
  // Config
  | { type: "reload_config" }
  // Auth
  | { type: "start_oauth" }
  | { type: "logout" };

export type Event = {
  submissionId?: string;
  msg: EventMsg;
};

export type EventMsg =
  // Connection handshake
  | { type: "connection_ready"; serverVersion: string; authStatus: AuthStatus; activeSession?: SessionSnapshot; activeTurn?: ActiveTurnState }
  // Turn lifecycle
  | { type: "turn_started"; turnId: string; model: string }
  | { type: "turn_complete"; turnId: string; usage: TokenUsage }
  | { type: "turn_aborted"; turnId: string; reason: "user_interrupted" | "error" | "shutdown" }
  | { type: "token_count"; session: TokenUsage; lastTurn?: TokenUsage }
  // Agent output (streaming)
  | { type: "agent_message_delta"; delta: string }
  | { type: "agent_message"; message: string }
  | { type: "agent_reasoning_delta"; delta: string }
  | { type: "agent_reasoning"; summary: string }
  // Tool calls (generic)
  | { type: "tool_call_begin"; callId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; callId: string; output: string; success: boolean }
  // Shell execution lifecycle
  | { type: "exec_command_begin"; callId: string; command: string; cwd: string }
  | { type: "exec_command_output_delta"; callId: string; chunk: string; stream: "stdout" | "stderr" }
  | { type: "exec_command_end"; callId: string; exitCode: number }
  // Patch lifecycle
  | { type: "patch_apply_begin"; callId: string; path: string; patch: string }
  | { type: "patch_apply_end"; callId: string; path: string; success: boolean; error?: string }
  // File diffs
  | { type: "turn_diff"; diffs: FileDiff[] }
  // Approval requests
  | { type: "exec_approval_request"; callId: string; command: string; cwd: string; risk: RiskLevel }
  | { type: "patch_approval_request"; callId: string; path: string; patch: string }
  | { type: "mcp_elicitation_request"; requestId: string; serverName: string; message: string; schema?: unknown }
  // MCP
  | { type: "mcp_startup_update"; server: string; status: "connecting" | "connected" | "failed"; error?: string }
  | { type: "mcp_startup_complete"; servers: McpServerStatus[] }
  | { type: "mcp_tool_call_begin"; callId: string; server: string; tool: string; args: Record<string, unknown> }
  | { type: "mcp_tool_call_end"; callId: string; result: unknown; success: boolean }
  | { type: "mcp_list_tools_response"; tools: McpToolInfo[] }
  // Skills
  | { type: "list_skills_response"; skills: SkillInfo[] }
  // Models
  | { type: "list_models_response"; models: ModelInfo[] }
  // Session management
  | { type: "session_created"; sessionId: string; name?: string }
  | { type: "session_loaded"; session: SessionSnapshot }
  | { type: "session_list"; sessions: SessionSummary[] }
  | { type: "session_name_updated"; sessionId: string; name: string }
  | { type: "session_deleted"; sessionId: string }
  // Context management
  | { type: "context_compacted"; previousTokens: number; newTokens: number }
  | { type: "undo_started" }
  | { type: "undo_completed"; turnId: string; revertedFiles: string[] }
  // Auth
  | { type: "auth_status"; status: AuthStatus }
  | { type: "oauth_redirect"; url: string }
  // System
  | { type: "error"; message: string; code?: ErrorCode; fatal: boolean }
  | { type: "warning"; message: string }
  | { type: "stream_error"; message: string; retrying: boolean; attempt?: number }
  | { type: "shutdown_complete" };

// --- Supporting Types ---

export type FileDiff = {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
  isBinary: boolean;
  truncated: boolean;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
};

export type AuthStatus = {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  user?: string;
};

export type ModelInfo = {
  id: string;
  name: string;
  supportsReasoning: boolean;
  contextWindow: number;
};

export type ActiveTurnState = {
  turnId: string;
  model: string;
  pendingApproval?: {
    type: "exec" | "patch" | "mcp_elicitation";
    callId: string;
  };
};

export type RiskLevel = "low" | "medium" | "high";

export type ErrorCode =
  | "TURN_IN_PROGRESS"
  | "SESSION_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "INVALID_MODEL"
  | "INVALID_SUBMISSION"
  | "INTERNAL_ERROR";

export type McpServerStatus = {
  name: string;
  status: "connected" | "failed";
  toolCount: number;
  error?: string;
};

export type McpToolInfo = {
  server: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

export type SkillInfo = {
  id: string;
  name: string;
  description: string;
  scope: "global" | "project";
};

export type SessionSummary = {
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  workingDir: string;
};

export type SessionSnapshot = {
  summary: SessionSummary;
  messages: ChatMessage[];
  workingDir: string;
  model: string;
  sandboxPolicy: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  toolCalls?: ToolCallRecord[];
};

export type ToolCallRecord = {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
  success: boolean;
  durationMs: number;
};
