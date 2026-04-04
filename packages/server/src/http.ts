import type { Server, ServerWebSocket } from "bun";
import type { ClawdexEngine } from "@clawdex/core";
import type { EventMsg, Submission, Event } from "@clawdex/shared-types";
import { validateToken, extractTokenFromUrl, extractTokenFromHeader } from "./auth-guard.js";
import { handleRestRequest, type RouteContext } from "./rest-routes.js";
import { parseSubmission, routeSubmission } from "./ws-handler.js";
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

export interface ServerConfig {
  engine: ClawdexEngine;
  host: string;
  port: number;
  token: string;
  staticDir?: string;
  version?: string;
}

interface WsData {
  authenticated: boolean;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".map": "application/json",
};

export function createServer(config: ServerConfig): Server {
  const { engine, host, port, token, staticDir, version = "0.0.1" } = config;
  const routeCtx: RouteContext = { engine, serverVersion: version };
  const wsClients = new Set<ServerWebSocket<WsData>>();

  // Forward engine events to all connected WS clients
  engine.on("event", (msg: EventMsg) => {
    const event: Event = { msg };
    const json = JSON.stringify(event);
    for (const ws of wsClients) {
      if (ws.data.authenticated) {
        ws.send(json);
      }
    }
  });

  return Bun.serve<WsData>({
    hostname: host,
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const wsToken = extractTokenFromUrl(req.url);
        if (!validateToken(token, wsToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const success = server.upgrade(req, {
          data: { authenticated: true },
        });
        return success ? undefined : new Response("Upgrade failed", { status: 500 });
      }

      // REST API auth check
      if (url.pathname.startsWith("/api/")) {
        const headerToken = extractTokenFromHeader(
          req.headers.get("authorization")
        );
        if (!validateToken(token, headerToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const restResponse = await handleRestRequest(req, routeCtx);
        if (restResponse) return restResponse;
        return new Response("Not Found", { status: 404 });
      }

      // Static file serving (web UI)
      if (staticDir) {
        return await serveStaticFile(url.pathname, staticDir);
      }

      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws) {
        wsClients.add(ws);
        // Send connection_ready event
        const readyEvent: Event = {
          msg: {
            type: "connection_ready",
            serverVersion: version,
            authStatus: { authenticated: true, method: "api_key" },
          } as EventMsg,
        };
        ws.send(JSON.stringify(readyEvent));
      },

      async message(ws, raw) {
        const submission = parseSubmission(String(raw));
        if (!submission) {
          ws.send(JSON.stringify({
            msg: { type: "error", message: "Invalid submission", code: "INVALID_SUBMISSION", fatal: false },
          }));
          return;
        }

        const handler = routeSubmission(submission.op);
        if (!handler) {
          ws.send(JSON.stringify({
            submissionId: submission.id,
            msg: { type: "error", message: `Unknown op: ${submission.op.type}`, code: "INVALID_SUBMISSION", fatal: false },
          }));
          return;
        }

        // Route to engine based on op type
        try {
          await handleOp(engine, submission);
        } catch (err) {
          ws.send(JSON.stringify({
            submissionId: submission.id,
            msg: { type: "error", message: String(err), fatal: false },
          }));
        }
      },

      close(ws) {
        wsClients.delete(ws);
      },
    },
  });
}

async function handleOp(engine: ClawdexEngine, sub: Submission): Promise<void> {
  const op = sub.op;

  switch (op.type) {
    case "user_turn":
      await engine.runTurn(op.sessionId, {
        prompt: op.prompt,
        model: op.model,
        effort: op.effort,
      });
      break;
    case "interrupt":
      engine.interrupt();
      break;
    case "undo":
      // Need session id from active session — handled by engine
      break;
    case "compact":
      break;
    case "create_session":
      await engine.createSession({
        workingDir: op.workingDir ?? process.cwd(),
        name: op.name,
      });
      break;
    case "load_session":
      await engine.loadSession(op.sessionId);
      break;
    case "delete_session":
      await engine.deleteSession(op.sessionId);
      break;
    case "set_session_name":
      await engine.setSessionName(op.sessionId, op.name);
      break;
    case "list_sessions": {
      const sessions = await engine.listSessions();
      await engine.emit({
        type: "session_list",
        sessions,
      } as EventMsg);
      break;
    }
    case "shutdown":
      await engine.emit({ type: "shutdown_complete" } as EventMsg);
      break;
  }
}

async function serveStaticFile(pathname: string, staticDir: string): Promise<Response> {
  let filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch {
    // Try with .html extension or fall back to index.html (SPA)
    filePath = join(staticDir, "index.html");
  }

  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      // SPA fallback
      const index = Bun.file(join(staticDir, "index.html"));
      return new Response(index, {
        headers: { "Content-Type": "text/html" },
      });
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
