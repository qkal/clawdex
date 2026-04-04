import type {
  ClawdexConfig,
  IAuthProvider,
  ISandbox,
  EventMsg,
  SessionSummary,
} from "@clawdex/shared-types";
import type { ToolRegistry } from "@clawdex/tools";
import type { McpManager } from "@clawdex/mcp-client";
import type { SkillRegistry } from "@clawdex/skills";
import type { EngineOptions, TurnOptions, OpenAIStreamEvent } from "./types.js";
import { Session } from "./session.js";
import { SessionStore } from "./session-store.js";
import { TurnRunner } from "./turn-runner.js";
import { createOpenAIStream } from "./openai-stream.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { shouldAutoCompact, buildCompactPrompt, compactMessages } from "./context-manager.js";
import { MemoryStore, buildMemoryContext } from "@clawdex/memories";
import { join } from "node:path";
import { homedir } from "node:os";

type EventHandler = (event: EventMsg) => void;

export class ClawdexEngine {
  readonly config: ClawdexConfig;
  private readonly authProvider: IAuthProvider;
  private readonly sandbox: ISandbox;
  private readonly toolRegistry: ToolRegistry;
  private readonly store: SessionStore;
  private readonly sessions = new Map<string, Session>();
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private activeTurnRunner: TurnRunner | null = null;
  private readonly memoriesStore?: MemoryStore;
  private readonly mcpManager?: McpManager;
  private readonly skillRegistry?: SkillRegistry;

  constructor(opts: EngineOptions) {
    this.config = opts.config;
    this.authProvider = opts.authProvider;
    this.sandbox = opts.sandbox;
    this.toolRegistry = opts.toolRegistry;
    const sessionsDir =
      opts.sessionsDir ?? join(homedir(), ".clawdex", "sessions");
    this.store = new SessionStore(sessionsDir);
    if (opts.memoriesDir) {
      this.memoriesStore = new MemoryStore(opts.memoriesDir);
    }
    this.mcpManager = opts.mcpManager;
    this.skillRegistry = opts.skillRegistry;
  }

  // -- Event Emitter --

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  async emit(msg: EventMsg): Promise<void> {
    const handlers = this.listeners.get("event");
    if (handlers) {
      for (const handler of handlers) {
        handler(msg);
      }
    }
  }

  // -- Session CRUD --

  async createSession(opts: {
    workingDir: string;
    name?: string;
  }): Promise<Session> {
    const session = new Session({
      workingDir: opts.workingDir,
      model: this.config.model,
      sandboxPolicy: this.config.sandbox_mode,
      name: opts.name,
    });
    this.sessions.set(session.id, session);
    await this.store.save(session);
    return session;
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  async loadSession(id: string): Promise<Session | null> {
    // Check in-memory first
    const existing = this.sessions.get(id);
    if (existing) return existing;

    // Load from disk
    const loaded = await this.store.load(id);
    if (loaded) {
      this.sessions.set(loaded.id, loaded);
    }
    return loaded;
  }

  async listSessions(): Promise<SessionSummary[]> {
    // Include both in-memory and on-disk sessions
    const diskSummaries = await this.store.list();
    const memoryIds = new Set(this.sessions.keys());

    // Merge: prefer in-memory (more up-to-date) over disk
    const result: SessionSummary[] = [];
    for (const s of this.sessions.values()) {
      result.push(s.toSummary());
    }
    for (const ds of diskSummaries) {
      if (!memoryIds.has(ds.id)) {
        result.push(ds);
      }
    }

    return result.sort(
      (a, b) =>
        new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    await this.store.delete(id);
  }

  async setSessionName(id: string, name: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.setName(name);
      await this.store.save(session);
    }
  }

  async saveSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await this.store.save(session);
    }
  }

  // -- Turn Execution --

  async runTurn(sessionId: string, opts: TurnOptions): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      await this.emit({
        type: "error",
        message: `Session not found: ${sessionId}`,
        code: "SESSION_NOT_FOUND",
        fatal: false,
      } as EventMsg);
      return;
    }

    // Get auth token
    const auth = await this.authProvider.getToken();
    if (!auth.token) {
      await this.emit({
        type: "error",
        message: "Authentication required",
        code: "AUTH_REQUIRED",
        fatal: false,
      } as EventMsg);
      return;
    }

    const model = opts.model ?? session.model;
    const turnId = `turn-${Date.now()}`;

    // Add user message to session
    session.addMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: opts.prompt,
      timestamp: new Date().toISOString(),
      turnId,
    });

    // Load memory context for system prompt injection
    const memorySummary = this.memoriesStore
      ? await this.memoriesStore.getSummary()
      : null;
    const memoryContext = buildMemoryContext(memorySummary);

    // Build additional context from memories and skills
    const contextParts: string[] = [];
    if (memoryContext) contextParts.push(memoryContext);
    const skillInstructions = this.skillRegistry?.getInstructions();
    if (skillInstructions) {
      contextParts.push("## Active Skills\n" + skillInstructions);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      config: this.config,
      model,
      workingDir: session.workingDir,
      sandboxPolicy: session.sandboxPolicy,
      additionalContext: contextParts.length > 0 ? contextParts.join("\n\n") : undefined,
    });

    // Build message list for API
    const toolSchemas = this.toolRegistry.listSchemas();

    const runner = new TurnRunner({
      turnId,
      model,
      workingDir: session.workingDir,
      toolRegistry: this.toolRegistry,
      sandbox: this.sandbox,
      emitEvent: async (e) => {
        await this.emit(e);
        // Record assistant messages to session
        if (e.type === "agent_message") {
          session.addMessage({
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: (e as any).message,
            timestamp: new Date().toISOString(),
            turnId,
          });
        }
        // Accumulate token usage
        if (e.type === "turn_complete") {
          session.addTokenUsage((e as any).usage);
        }
      },
      createStream: () =>
        createOpenAIStream({
          baseUrl: this.config.auth.base_url,
          apiKey: auth.token,
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...session.messages.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
          ],
          tools: toolSchemas,
          reasoningEffort: opts.effort,
        }),
    });

    this.activeTurnRunner = runner;
    try {
      await runner.run();
    } finally {
      this.activeTurnRunner = null;
      // Auto-save after turn completes
      await this.store.save(session);
    }
  }

  // -- Turn Control --

  interrupt(): void {
    this.activeTurnRunner?.interrupt();
  }

  async undo(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await this.emit({ type: "undo_started" } as EventMsg);
    const removed = session.popLastTurnMessages();
    const revertedFiles = removed
      .flatMap((m) => m.toolCalls ?? [])
      .filter((tc) => tc.tool === "file-write" || tc.tool === "apply-patch")
      .map((tc) => tc.args.path as string)
      .filter(Boolean);

    await this.emit({
      type: "undo_completed",
      turnId: removed[0]?.turnId ?? "",
      revertedFiles,
    } as EventMsg);

    await this.store.save(session);
  }

  async compact(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const prompt = buildCompactPrompt(session.messages);

    // Get auth for the compact API call
    const auth = await this.authProvider.getToken();
    if (!auth.token) return;

    // Use the LLM to generate a summary
    let summary = "";
    const stream = createOpenAIStream({
      baseUrl: this.config.auth.base_url,
      apiKey: auth.token,
      model: this.config.model,
      messages: [{ role: "user", content: prompt }],
      tools: [],
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        summary += event.delta;
      }
    }

    if (summary) {
      const previousTokens = session.tokenUsage.totalTokens;
      const lastUserMsg = [...session.messages]
        .reverse()
        .find((m) => m.role === "user");
      session.replaceMessages(compactMessages(summary, lastUserMsg));
      const newTokens = session.tokenUsage.totalTokens;

      await this.emit({
        type: "context_compacted",
        previousTokens,
        newTokens,
      } as EventMsg);

      await this.store.save(session);
    }
  }
}
