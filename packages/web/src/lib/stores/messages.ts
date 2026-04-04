import { writable } from "svelte/store";

export interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  turnId?: string;
  streaming?: boolean;
  reasoning?: string;
  toolCalls?: UIToolCall[];
}

export interface UIToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  output?: string;
  success?: boolean;
  status: "pending" | "running" | "complete";
}

export const messages = writable<UIMessage[]>([]);
export const streamingDelta = writable<string>("");
export const isStreaming = writable<boolean>(false);
