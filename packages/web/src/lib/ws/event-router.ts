import type { Event, EventMsg } from "@clawdex/shared-types";
import {
  messages,
  streamingDelta,
  isStreaming,
  type UIMessage,
  type UIToolCall,
} from "../stores/messages.js";
import { sessionList, activeSessionId, activeSnapshot } from "../stores/session.js";
import { connectionStatus } from "../stores/connection.js";
import { get } from "svelte/store";

/** Route a server event to the appropriate store updates. */
export function routeEvent(event: Event): void {
  const msg = event.msg;

  switch (msg.type) {
    case "connection_ready":
      connectionStatus.set("connected");
      break;

    case "turn_started":
      isStreaming.set(true);
      streamingDelta.set("");
      break;

    case "agent_message_delta":
      streamingDelta.update((d) => d + (msg as any).delta);
      break;

    case "agent_message": {
      isStreaming.set(false);
      const delta = get(streamingDelta);
      streamingDelta.set("");
      messages.update((msgs) => [
        ...msgs,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: (msg as any).message || delta,
          timestamp: new Date().toISOString(),
          streaming: false,
        },
      ]);
      break;
    }

    case "turn_complete":
      isStreaming.set(false);
      streamingDelta.set("");
      break;

    case "turn_aborted":
      isStreaming.set(false);
      streamingDelta.set("");
      break;

    case "tool_call_begin": {
      const tc = msg as any;
      messages.update((msgs) => {
        return [
          ...msgs,
          {
            id: `tc-${tc.callId}`,
            role: "system" as const,
            content: `Tool: ${tc.tool}`,
            timestamp: new Date().toISOString(),
            toolCalls: [{
              callId: tc.callId,
              tool: tc.tool,
              args: tc.args,
              status: "running" as const,
            }],
          },
        ];
      });
      break;
    }

    case "tool_call_end": {
      const tc = msg as any;
      messages.update((msgs) =>
        msgs.map((m) => {
          if (m.toolCalls?.[0]?.callId === tc.callId) {
            return {
              ...m,
              toolCalls: m.toolCalls!.map((t) =>
                t.callId === tc.callId
                  ? { ...t, output: tc.output, success: tc.success, status: "complete" as const }
                  : t
              ),
            };
          }
          return m;
        })
      );
      break;
    }

    case "session_list":
      sessionList.set((msg as any).sessions);
      break;

    case "session_created": {
      const created = msg as any;
      activeSessionId.set(created.sessionId);
      break;
    }

    case "session_loaded":
      activeSnapshot.set((msg as any).session);
      break;

    case "error":
      console.error("[clawdex]", (msg as any).message);
      break;
  }
}
