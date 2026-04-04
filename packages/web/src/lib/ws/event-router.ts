import type { Event } from "@clawdex/shared-types";
import {
  messages,
  streamingDelta,
  isStreaming,
  type UIMessage,
} from "../stores/messages.js";
import { sessionList, activeSessionId, activeSnapshot } from "../stores/session.js";
import { connectionStatus } from "../stores/connection.js";
import { get } from "svelte/store";

/** Route a server event to the appropriate store updates. */
export function routeEvent(event: Event): void {
  const msg = event.msg;

  switch (msg.type) {
    case "connection_ready":
      // Restore session state if reconnecting
      if (msg.activeSession) {
        activeSnapshot.set(msg.activeSession);
        // Convert ChatMessage[] to UIMessage[]
        const uiMessages: UIMessage[] = msg.activeSession.messages.map((chatMsg) => ({
          id: chatMsg.id,
          role: chatMsg.role,
          content: chatMsg.content,
          timestamp: chatMsg.timestamp,
          turnId: chatMsg.turnId,
          streaming: false,
          toolCalls: chatMsg.toolCalls?.map((tc) => ({
            callId: tc.callId,
            tool: tc.tool,
            args: tc.args,
            output: tc.output,
            success: tc.success,
            status: "complete" as const,
          })),
        }));
        messages.set(uiMessages);
      }
      // Restore streaming state if there's an active turn
      if (msg.activeTurn) {
        isStreaming.set(true);
      }
      connectionStatus.set("connected");
      break;

    case "turn_started":
      isStreaming.set(true);
      streamingDelta.set("");
      break;

    case "agent_message_delta":
      streamingDelta.update((d) => d + msg.delta);
      break;

    case "agent_message": {
      isStreaming.set(false);
      const delta = get(streamingDelta);
      streamingDelta.set("");
      const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
        ? `msg-${crypto.randomUUID()}`
        : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      messages.update((msgs) => [
        ...msgs,
        {
          id: uniqueId,
          role: "assistant",
          content: msg.message || delta,
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
      messages.update((msgs) => {
        return [
          ...msgs,
          {
            id: `tc-${msg.callId}`,
            role: "system" as const,
            content: `Tool: ${msg.tool}`,
            timestamp: new Date().toISOString(),
            toolCalls: [{
              callId: msg.callId,
              tool: msg.tool,
              args: msg.args,
              status: "running" as const,
            }],
          },
        ];
      });
      break;
    }

    case "tool_call_end": {
      messages.update((msgs) =>
        msgs.map((m) => {
          if (m.toolCalls?.[0]?.callId === msg.callId) {
            return {
              ...m,
              toolCalls: m.toolCalls!.map((t) =>
                t.callId === msg.callId
                  ? { ...t, output: msg.output, success: msg.success, status: "complete" as const }
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
      sessionList.set(msg.sessions);
      break;

    case "session_created": {
      activeSessionId.set(msg.sessionId);
      break;
    }

    case "session_loaded": {
      const snapshot = msg.session;
      // Transform ChatMessage[] to UIMessage[]
      const uiMessages: UIMessage[] = snapshot.messages.map((chatMsg) => ({
        id: chatMsg.id,
        role: chatMsg.role,
        content: chatMsg.content,
        timestamp: chatMsg.timestamp,
        turnId: chatMsg.turnId,
        streaming: false,
        toolCalls: chatMsg.toolCalls?.map((tc) => ({
          callId: tc.callId,
          tool: tc.tool,
          args: tc.args,
          output: tc.output,
          success: tc.success,
          status: "complete" as const,
        })),
      }));
      messages.set(uiMessages);
      activeSnapshot.set(snapshot);
      break;
    }

    case "agent_reasoning_delta":
      // Update the last assistant message with incremental reasoning
      messages.update((msgs) => {
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
          const updated = [...msgs];
          updated[lastIdx] = {
            ...updated[lastIdx],
            reasoning: (updated[lastIdx].reasoning || "") + msg.delta,
          };
          return updated;
        }
        return msgs;
      });
      break;

    case "agent_reasoning":
      // Set final reasoning on the last assistant message
      messages.update((msgs) => {
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
          const updated = [...msgs];
          updated[lastIdx] = {
            ...updated[lastIdx],
            reasoning: msg.summary,
          };
          return updated;
        }
        return msgs;
      });
      break;

    case "exec_approval_request":
      // Log approval request - UI implementation pending
      console.log("[clawdex] Exec approval request:", {
        callId: msg.callId,
        command: msg.command,
        cwd: msg.cwd,
        risk: msg.risk,
      });
      break;

    case "patch_approval_request":
      // Log approval request - UI implementation pending
      console.log("[clawdex] Patch approval request:", {
        callId: msg.callId,
        path: msg.path,
      });
      break;

    case "mcp_elicitation_request":
      // Log approval request - UI implementation pending
      console.log("[clawdex] MCP elicitation request:", {
        requestId: msg.requestId,
        serverName: msg.serverName,
        message: msg.message,
      });
      break;

    case "error":
      console.error("[clawdex]", msg.message);
      if (msg.fatal) {
        connectionStatus.set("disconnected");
      }
      break;
  }
}
