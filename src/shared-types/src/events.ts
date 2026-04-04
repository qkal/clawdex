import type { ErrorCode } from "./errors";
import type { AuthStatus } from "./auth";

// ── Submissions (Client → Server) ─────────────────────────────

export interface Submission {
  id: string;
  op: Op;
}

export type Op =
  | { type: "user_turn"; prompt: string; sessionId: string; model?: string; effort?: "low" | "medium" | "high" }
  | { type: "interrupt" }
  | { type: "undo" }
  | { type: "compact" }
  | { type: "shutdown" }
  | { type: "exec_approval"; callId: string; decision: "approve" | "deny"; reason?: string }
  | { type: "patch_approval"; callId: string; decision: "approve" | "deny" }
  | { type: "mcp_elicitation_response"; requestId: string; serverName: string; decision: "approve" | "deny"; content?: unknown }
  | { type: "create_session"; workingDir?: string; name?: string }
  | { type: "load_session"; sessionId: string }
  | { type: "delete_session"; sessionId: string }
  | { type: "set_session_name"; sessionId: string; name: string }
  | { type: "list_sessions" }
  | { type: "run_user_shell_command"; command: string }
  | { type: "list_models" }
  | { type: "list_mcp_tools" }
  | { type: "refresh_mcp_servers" }
  | { type: "list_skills"; workingDirs?: string[] }
  | { type: "update_memories" }
  | { type: "drop_memories" }
  | { type: "reload_config" }
  | { type: "start_oauth" }
  | { type: "logout" };

// ── Events (Server → Client) ──────────────────────────────────

export interface Event {
  submissionId?: string;
  msg: EventMsg;
}

export type EventMsg =
  // Connection
  | { type: "connection_ready"; serverVersion: string; authStatus: AuthStatus; activeSession?: SessionSnapshot; activeTurn?: ActiveTurnState }
  // Turn lifecycle
  | { type: "turn_started"; turnId: string; model: string }
  | { type: "turn_complete"; turnId: string; usage: TokenUsage }
  | { type: "turn_aborted"; turnId: string; reason: "user_interrupted" | "error" | "shutdown" | "max_tool_rounds" }
  | { type: "token_count"; session: TokenUsage; lastTurn?: TokenUsage }
  // Agent output
  | { type: "agent_message_delta"; delta: string }
  | { type: "agent_message"; message: string }
  | { type: "agent_reasoning_delta"; delta: string }
  | { type: "agent_reasoning"; summary: string }
  // Tool calls (generic)
  | { type: "tool_call_begin"; callId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; callId: string; output: string; success: boolean }
  // Shell execution
  | { type: "exec_command_begin"; callId: string; command: string; cwd: string }
  | { type: "exec_command_output_delta"; callId: string; chunk: string; stream: "stdout" | "stderr" }
  | { type: "exec_command_end"; callId: string; exitCode: number }
  // Patch
  | { type: "patch_apply_begin"; callId: string; path: string; patch: string }
  | { type: "patch_apply_end"; callId: string; path: string; success: boolean; error?: string }
  // Diffs
  | { type: "turn_diff"; diffs: FileDiff[] }
  // Approvals
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
  // Sessions
  | { type: "session_created"; sessionId: string; name?: string }
  | { type: "session_loaded"; session: SessionSnapshot }
  | { type: "session_list"; sessions: SessionSummary[] }
  | { type: "session_name_updated"; sessionId: string; name: string }
  | { type: "session_deleted"; sessionId: string }
  // Context
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

// ── Supporting Types ──────────────────────────────────────────

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
  isBinary: boolean;
  truncated: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface ActiveTurnState {
  turnId: string;
  model: string;
  pendingApproval?: {
    type: "exec" | "patch" | "mcp_elicitation";
    callId: string;
  };
}

export interface McpServerStatus {
  name: string;
  status: "connected" | "failed";
  toolCount: number;
  error?: string;
}

export interface McpToolInfo {
  server: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: "global" | "project";
}

export interface ModelInfo {
  id: string;
  name: string;
  supportsReasoning: boolean;
  contextWindow: number;
}

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  workingDir: string;
}

export interface ToolCallRecord {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
  success: boolean;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  toolCalls?: ToolCallRecord[];
}

export interface SessionSnapshot {
  summary: SessionSummary;
  messages: ChatMessage[];
  workingDir: string;
  model: string;
  sandboxPolicy: string;
}
