// Core engine
export { ClawdexEngine } from "./engine.js";

// Session
export { Session } from "./session.js";
export type { SessionCreateOptions } from "./session.js";

// Session store
export { SessionStore } from "./session-store.js";

// Turn execution
export { TurnRunner } from "./turn-runner.js";
export type { TurnRunnerOptions } from "./turn-runner.js";

// OpenAI streaming
export { createOpenAIStream, parseSSELine } from "./openai-stream.js";
export type { OpenAIStreamConfig } from "./openai-stream.js";

// Tool dispatch
export { dispatchToolCall } from "./tool-dispatch.js";

// Context management
export {
  estimateTokens,
  shouldAutoCompact,
  buildCompactPrompt,
  compactMessages,
} from "./context-manager.js";

// System prompt
export { buildSystemPrompt } from "./system-prompt.js";
export type { SystemPromptOptions } from "./system-prompt.js";

// Types
export type {
  EngineOptions,
  TurnOptions,
  TurnState,
  SessionFile,
  OpenAIMessage,
  OpenAIStreamEvent,
} from "./types.js";
