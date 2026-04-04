import type { Submission, Op } from "@clawdex/shared-types";

/** Parse a raw WebSocket message string into a typed Submission. */
export function parseSubmission(raw: string): Submission | null {
  try {
    const data = JSON.parse(raw);
    if (!data.id || !data.op || !data.op.type) return null;
    return data as Submission;
  } catch {
    return null;
  }
}

/** Route op type to handler name. Returns null for unknown ops. */
export function routeSubmission(op: Op): string | null {
  const routes: Record<string, string> = {
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
  return routes[op.type] ?? null;
}
