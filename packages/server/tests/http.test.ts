import { describe, test, expect, afterEach } from "bun:test";
import { createServer } from "../src/http.js";
import { ClawdexEngine } from "@clawdex/core";
import { createTestConfig, MockSandbox } from "@clawdex/testkit";
import { ToolRegistry } from "@clawdex/tools";
import type { Server } from "bun";

let server: Server | null = null;

afterEach(() => {
  if (server) {
    server.stop(true);
    server = null;
  }
});

const mockAuthProvider = {
  getToken: async () => ({ token: "test-api-key", expiresAt: null }),
  getStatus: async () => ({ authenticated: true, method: "api_key" as const }),
  logout: async () => {},
};

function makeServer(port: number = 0) {
  const engine = new ClawdexEngine({
    config: createTestConfig(),
    authProvider: mockAuthProvider,
    sandbox: new MockSandbox(),
    toolRegistry: new ToolRegistry(),
  });
  const token = "test-token-12345";
  server = createServer({
    engine,
    host: "127.0.0.1",
    port,
    token,
    version: "0.0.1-test",
  });
  return { engine, token, url: `http://127.0.0.1:${server.port}` };
}

describe("REST endpoints", () => {
  test("GET /api/health returns 200 with auth", async () => {
    const { token, url } = makeServer();
    const res = await fetch(`${url}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.0.1-test");
  });

  test("GET /api/health returns 401 without auth", async () => {
    const { url } = makeServer();
    const res = await fetch(`${url}/api/health`);
    expect(res.status).toBe(401);
  });

  test("GET /api/health returns 401 with wrong token", async () => {
    const { url } = makeServer();
    const res = await fetch(`${url}/api/health`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/sessions returns empty array", async () => {
    const { token, url } = makeServer();
    const res = await fetch(`${url}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });

  test("GET /api/config returns config object", async () => {
    const { token, url } = makeServer();
    const res = await fetch(`${url}/api/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
  });

  test("GET /api/unknown returns 404", async () => {
    const { token, url } = makeServer();
    const res = await fetch(`${url}/api/unknown`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  test("non-API route without static dir returns 404", async () => {
    const { url } = makeServer();
    const res = await fetch(`${url}/`);
    expect(res.status).toBe(404);
  });
});
