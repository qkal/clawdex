import { writable } from "svelte/store";
import { ClawdexWsClient } from "../ws/client.js";

export const connectionStatus = writable<"connecting" | "connected" | "disconnected">("disconnected");
export const wsClient = writable<ClawdexWsClient | null>(null);

export function initConnection(host: string, port: number, token: string) {
  const url = `ws://${host}:${port}/?token=${encodeURIComponent(token)}`;
  const client = new ClawdexWsClient(url);

  client.onEvent((event) => {
    if (event.msg.type === "connection_ready") {
      connectionStatus.set("connected");
    }
  });

  connectionStatus.set("connecting");
  client.connect();
  wsClient.set(client);

  return client;
}
