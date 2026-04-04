import { parseEvent, createSubmission } from "./protocol.js";
import type { Op, Event } from "@clawdex/shared-types";

export type EventHandler = (event: Event) => void;

export class ClawdexWsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Set<EventHandler>();
  private reconnectAttempt = 0;
  private maxReconnectDelay = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    this.ws.onmessage = (event) => {
      const parsed = parseEvent(String(event.data));
      if (parsed) {
        for (const handler of this.handlers) {
          handler(parsed);
        }
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  send(op: Op): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const submission = createSubmission(op);
    this.ws.send(JSON.stringify(submission));
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      100 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
