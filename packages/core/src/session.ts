import { nanoid } from "nanoid";
import type {
  ChatMessage,
  TokenUsage,
  SessionSnapshot,
  SessionSummary,
  FileDiff,
} from "@clawdex/shared-types";

export interface SessionCreateOptions {
  workingDir: string;
  model: string;
  sandboxPolicy: string;
  id?: string;
  name?: string;
  createdAt?: string;
  lastActiveAt?: string;
}

export class Session {
  readonly id: string;
  readonly createdAt: string;
  readonly workingDir: string;
  model: string;
  sandboxPolicy: string;
  name?: string;
  lastActiveAt: string;

  private _messages: ChatMessage[] = [];
  private _tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private _diffs: FileDiff[] = [];

  constructor(opts: SessionCreateOptions) {
    this.id = opts.id ?? nanoid(12);
    this.createdAt = opts.createdAt ?? new Date().toISOString();
    this.lastActiveAt = opts.lastActiveAt ?? this.createdAt;
    this.workingDir = opts.workingDir;
    this.model = opts.model;
    this.sandboxPolicy = opts.sandboxPolicy;
    this.name = opts.name;
  }

  get messages(): readonly ChatMessage[] {
    return this._messages;
  }

  get tokenUsage(): TokenUsage {
    return { ...this._tokenUsage };
  }

  get diffs(): readonly FileDiff[] {
    return this._diffs;
  }

  addMessage(msg: ChatMessage): void {
    this._messages.push(msg);
    this.lastActiveAt = new Date().toISOString();
  }

  addTokenUsage(usage: TokenUsage): void {
    this._tokenUsage.inputTokens += usage.inputTokens;
    this._tokenUsage.outputTokens += usage.outputTokens;
    this._tokenUsage.totalTokens += usage.totalTokens;
  }

  addDiffs(diffs: FileDiff[]): void {
    this._diffs.push(...diffs);
    this.lastActiveAt = new Date().toISOString();
  }

  setName(name: string): void {
    this.name = name;
    this.lastActiveAt = new Date().toISOString();
  }

  /** Replace entire message history (used by compact). */
  replaceMessages(messages: ChatMessage[]): void {
    this._messages = [...messages];
    this.lastActiveAt = new Date().toISOString();
  }

  /** Remove and return all messages belonging to the most recent turnId. */
  popLastTurnMessages(): ChatMessage[] {
    if (this._messages.length === 0) return [];

    // Find the last turnId
    let lastTurnId: string | undefined;
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].turnId) {
        lastTurnId = this._messages[i].turnId;
        break;
      }
    }
    if (!lastTurnId) return [];

    const removed: ChatMessage[] = [];
    this._messages = this._messages.filter((m) => {
      if (m.turnId === lastTurnId) {
        removed.push(m);
        return false;
      }
      return true;
    });
    this.lastActiveAt = new Date().toISOString();
    return removed;
  }

  toSnapshot(): SessionSnapshot {
    return {
      summary: this.toSummary(),
      messages: [...this._messages],
      workingDir: this.workingDir,
      model: this.model,
      sandboxPolicy: this.sandboxPolicy,
    };
  }

  toSummary(): SessionSummary {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      messageCount: this._messages.length,
      workingDir: this.workingDir,
    };
  }
}