// ============================================================
// @clawdex/core — Stub for Phase 4 (Server + Web)
// Full implementation in Phase 3. This stub provides the minimal
// ClawdexEngine interface that the server package needs.
// ============================================================

import type {
  EventMsg,
  SessionSummary,
  SessionSnapshot,
} from "@clawdex/shared-types";

export type TurnOptions = {
  prompt: string;
  model?: string;
  effort?: "low" | "medium" | "high";
};

export type CreateSessionOptions = {
  workingDir: string;
  name?: string;
};

type EventHandler = (msg: EventMsg) => void;

/**
 * Stub ClawdexEngine for Phase 4.
 * The real engine (Phase 3) will manage sessions, turns, tools, and LLM calls.
 * This stub emits events and provides the interface the server needs.
 */
export class ClawdexEngine {
  private handlers = new Set<EventHandler>();
  private _config: Record<string, unknown> = {};

  get config(): Record<string, unknown> {
    return this._config;
  }

  /** Subscribe to engine events. */
  on(_eventName: "event", handler: EventHandler): void {
    this.handlers.add(handler);
  }

  /** Remove event handler. */
  off(_eventName: "event", handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  /** Emit an event to all listeners. */
  async emit(msg: EventMsg): Promise<void> {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  /** Run a turn in the specified session. */
  async runTurn(sessionId: string, options: TurnOptions): Promise<void> {
    await this.emit({
      type: "turn_started",
      turnId: `turn-${Date.now()}`,
      model: options.model ?? "gpt-4o",
    });
    // Stub: in Phase 3 this will call OpenAI, dispatch tools, etc.
    await this.emit({
      type: "agent_message",
      message: `[stub] Echo: ${options.prompt}`,
    });
    await this.emit({
      type: "turn_complete",
      turnId: `turn-${Date.now()}`,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
  }

  /** Interrupt the current turn. */
  interrupt(): void {
    // Stub: no-op
  }

  /** Create a new session. */
  async createSession(options: CreateSessionOptions): Promise<string> {
    const sessionId = `sess-${Date.now().toString(36)}`;
    await this.emit({
      type: "session_created",
      sessionId,
      name: options.name,
    });
    return sessionId;
  }

  /** Load a session by ID. */
  async loadSession(sessionId: string): Promise<void> {
    await this.emit({
      type: "session_loaded",
      session: {
        summary: {
          id: sessionId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          messageCount: 0,
          workingDir: process.cwd(),
        },
        messages: [],
        workingDir: process.cwd(),
        model: "gpt-4o",
        sandboxPolicy: "workspace-write",
      },
    });
  }

  /** Delete a session. */
  async deleteSession(sessionId: string): Promise<void> {
    await this.emit({ type: "session_deleted", sessionId });
  }

  /** Set session name. */
  async setSessionName(sessionId: string, name: string): Promise<void> {
    await this.emit({ type: "session_name_updated", sessionId, name });
  }

  /** List all sessions. */
  async listSessions(): Promise<SessionSummary[]> {
    return [];
  }
}
