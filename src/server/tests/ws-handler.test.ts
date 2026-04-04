import { describe, test, expect } from "bun:test";
import { parseSubmission, routeSubmission } from "../src/ws-handler.js";
import type { Op } from "@clawdex/shared-types";

describe("parseSubmission", () => {
  test("parses a valid JSON submission", () => {
    const raw = JSON.stringify({
      id: "sub-1",
      op: { type: "user_turn", prompt: "hello", sessionId: "sess-1" },
    });
    const result = parseSubmission(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("sub-1");
    expect(result!.op.type).toBe("user_turn");
  });

  test("returns null for invalid JSON", () => {
    expect(parseSubmission("not json")).toBeNull();
  });

  test("returns null for missing id", () => {
    expect(parseSubmission(JSON.stringify({ op: { type: "interrupt" } }))).toBeNull();
  });

  test("returns null for missing op", () => {
    expect(parseSubmission(JSON.stringify({ id: "sub-1" }))).toBeNull();
  });

  test("returns null for missing op.type", () => {
    expect(parseSubmission(JSON.stringify({ id: "sub-1", op: {} }))).toBeNull();
  });
});

describe("routeSubmission", () => {
  test("returns the correct handler name for known op types", () => {
    expect(routeSubmission({ type: "user_turn", prompt: "hi", sessionId: "s1" } as Op)).toBe("userTurn");
    expect(routeSubmission({ type: "interrupt" } as Op)).toBe("interrupt");
    expect(routeSubmission({ type: "create_session" } as Op)).toBe("createSession");
    expect(routeSubmission({ type: "list_sessions" } as Op)).toBe("listSessions");
    expect(routeSubmission({ type: "shutdown" } as Op)).toBe("shutdown");
    expect(routeSubmission({ type: "compact" } as Op)).toBe("compact");
    expect(routeSubmission({ type: "undo" } as Op)).toBe("undo");
  });

  test("returns null for unknown op type", () => {
    expect(routeSubmission({ type: "unknown_op" } as any)).toBeNull();
  });

  test("routes all op types correctly", () => {
    const expected: Record<string, string> = {
      user_turn: "userTurn",
      interrupt: "interrupt",
      undo: "undo",
      compact: "compact",
      shutdown: "shutdown",
      exec_approval: "execApproval",
      patch_approval: "patchApproval",
      create_session: "createSession",
      load_session: "loadSession",
      delete_session: "deleteSession",
      set_session_name: "setSessionName",
      list_sessions: "listSessions",
      list_models: "listModels",
      reload_config: "reloadConfig",
      start_oauth: "startOAuth",
      logout: "logout",
      run_user_shell_command: "runUserShellCommand",
      list_mcp_tools: "listMcpTools",
      refresh_mcp_servers: "refreshMcpServers",
      list_skills: "listSkills",
      update_memories: "updateMemories",
      drop_memories: "dropMemories",
      mcp_elicitation_response: "mcpElicitationResponse",
    };

    for (const [opType, handlerName] of Object.entries(expected)) {
      expect(routeSubmission({ type: opType } as any)).toBe(handlerName);
    }
  });
});
