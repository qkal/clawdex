import type {
  ClawdexConfig,
  SessionSummary,
  ChatMessage,
  SessionSnapshot,
} from "@clawdex/shared-types";
import { DEFAULT_CONFIG } from "@clawdex/config";

export function createTestConfig(overrides?: Partial<ClawdexConfig>): ClawdexConfig {
  return { ...structuredClone(DEFAULT_CONFIG), ...overrides };
}

export function createTestSession(overrides?: Partial<SessionSummary>): SessionSummary {
  return {
    id: "test-session-001",
    name: "Test Session",
    createdAt: "2026-04-04T10:00:00Z",
    lastActiveAt: "2026-04-04T10:30:00Z",
    messageCount: 2,
    workingDir: "/test/project",
    ...overrides,
  };
}

export function createTestMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-001",
    role: "user",
    content: "Hello, world!",
    timestamp: "2026-04-04T10:00:00Z",
    ...overrides,
  };
}

export function createTestSnapshot(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  const defaultMessages = [
    createTestMessage(),
    createTestMessage({
      id: "msg-002",
      role: "assistant",
      content: "Hello! How can I help you?",
      timestamp: "2026-04-04T10:00:05Z",
    }),
  ];

  const messages = overrides?.messages ?? defaultMessages;
  const baseSummary = createTestSession();
  const finalSummary = { ...baseSummary, ...overrides?.summary, messageCount: messages.length };

  return {
    summary: finalSummary,
    messages,
    workingDir: overrides?.workingDir ?? baseSummary.workingDir,
    model: overrides?.model ?? "gpt-4o",
    sandboxPolicy: overrides?.sandboxPolicy ?? "workspace-write",
  };
}