import { describe, test, expect } from "bun:test";
import { startCallbackServer } from "../src/callback-server.js";

describe("OAuth callback server", () => {
  test("starts on a random port and returns the port", async () => {
    const { port, stop, codePromise } = await startCallbackServer();
    expect(port).toBeGreaterThan(0);

    // Simulate OAuth redirect with code
    const url = `http://127.0.0.1:${port}/callback?code=test-auth-code&state=test-state`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);

    const code = await codePromise;
    expect(code).toBe("test-auth-code");

    stop();
  });

  test("returns error page for missing code", async () => {
    const { port, stop } = await startCallbackServer();

    const url = `http://127.0.0.1:${port}/callback`;
    const res = await fetch(url);
    expect(res.status).toBe(400);

    stop();
  });

  test("returns 404 for unknown paths", async () => {
    const { port, stop } = await startCallbackServer();

    const url = `http://127.0.0.1:${port}/unknown`;
    const res = await fetch(url);
    expect(res.status).toBe(404);

    stop();
  });
});
