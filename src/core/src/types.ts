import type {
  ClawdexConfig,
  IAuthProvider,
  ISandbox,
  TokenUsage,
  ChatMessage,
  FileDiff,
} from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";

/** Options for creating a ClawdexEngine instance. */
export interface EngineOptions {
  config: ClawdexConfig;
  authProvider: IAuthProvider;
  sandbox: ISandbox;
  toolRegistry: ToolRegistry;
  /** Base directory for session storage. Defaults to ~/.clawdex/sessions/ */
  sessionsDir?: string;
  /** Base directory for memories storage. When set, memories are injected into system prompts. */
  memoriesDir?: string;
  /** Optional MCP connection manager for external tool servers. */
  mcpManager?: import("@clawdex/mcp-client").McpManager;
  /** Optional skill registry for injecting skill instructions into prompts. */
  skillRegistry?: import("@clawdex/skills").SkillRegistry;
}

/** Internal state of a turn in progress. */
export interface TurnState {
  turnId: string;
  model: string;
  /** Messages sent to OpenAI for this turn (includes history + new user message). */
  inputMessages: OpenAIMessage[];
  /** Whether we're waiting for user approval before continuing. */
  pendingApproval: PendingApproval | null;
  /** Accumulated token usage for this turn. */
  usage: TokenUsage;
  /** Whether the turn has been interrupted by the user. */
  interrupted: boolean;
  /** Tool calls made during this turn, for undo tracking. */
  filesModified: Set<string>;
}

export interface PendingApproval {
  type: "exec" | "patch" | "mcp_elicitation";
  callId: string;
  resolve: (decision: "approve" | "deny") => void;
}

/** Minimal OpenAI message format for the Responses API. */
export type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; tool_call_id: string; content: string }
  /** Represents an assistant function-call item in the Responses API input. */
  | { type: "function_call"; call_id: string; name: string; arguments: string };

/** Parsed streaming event from OpenAI SSE. */
export type OpenAIStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.reasoning_summary_text.delta"; delta: string }
  | { type: "response.output_text.done"; text: string }
  | { type: "response.reasoning_summary_text.done"; text: string }
  | { type: "response.function_call_arguments.delta"; call_id: string; delta: string }
  | { type: "response.function_call_arguments.done"; call_id: string; name: string; arguments: string }
  | { type: "response.completed"; usage: { input_tokens: number; output_tokens: number } }
  | { type: "response.error"; message: string }
  | { type: "response.done" }
  /** Emitted before each retry attempt; consumed by TurnRunner to surface to the UI. */
  | { type: "stream_retrying"; attempt: number; status: number; message: string };

/** Options for a single turn execution. */
export interface TurnOptions {
  prompt: string;
  model?: string;
  effort?: "low" | "medium" | "high";
}

/** Persisted session file format (v1). */
export interface SessionFile {
  version: 1;
  id: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  workingDir: string;
  model: string;
  sandboxPolicy: string;
  messages: ChatMessage[];
  tokenUsage: TokenUsage;
  diffs: FileDiff[];
}