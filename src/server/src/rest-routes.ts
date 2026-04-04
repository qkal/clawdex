import type { ClawdexEngine } from "@clawdex/core";

export interface RouteContext {
  engine: ClawdexEngine;
  serverVersion: string;
}

/** Handle REST API requests. Returns a Response or null (not matched). */
export async function handleRestRequest(
  req: Request,
  ctx: RouteContext,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/health" && req.method === "GET") {
    return Response.json({
      status: "ok",
      version: ctx.serverVersion,
      uptime: process.uptime(),
    });
  }

  if (path === "/api/sessions" && req.method === "GET") {
    const sessions = await ctx.engine.listSessions();
    return Response.json({ sessions });
  }

  if (path === "/api/config" && req.method === "GET") {
    return Response.json({ config: ctx.engine.config });
  }

  return null; // Not a REST route
}
