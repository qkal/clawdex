import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OAuthAuthProvider } from "../src/oauth.js";
import { TokenStore } from "../src/token-store.js";

describe("OAuthAuthProvider", () => {
  let dir: string;
  let tokenStore: TokenStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-oauth-"));
    tokenStore = new TokenStore(join(dir, "auth.json"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("getStatus returns not authenticated when no tokens stored", async () => {
    const provider = new OAuthAuthProvider({ tokenStore });
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });

  test("getStatus returns authenticated when valid tokens exist", async () => {
    await tokenStore.save({
      accessToken: "valid-token",
      expiresAt: "2030-01-01T00:00:00Z",
      user: "testuser",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(true);
    expect(status.method).toBe("oauth");
    expect(status.user).toBe("testuser");
  });

  test("getToken returns stored access token", async () => {
    await tokenStore.save({
      accessToken: "valid-token",
      expiresAt: "2030-01-01T00:00:00Z",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    const result = await provider.getToken();
    expect(result.token).toBe("valid-token");
  });

  test("getToken returns empty when no tokens and no refresh possible", async () => {
    const provider = new OAuthAuthProvider({ tokenStore });
    const result = await provider.getToken();
    expect(result.token).toBe("");
  });

  test("logout clears stored tokens", async () => {
    await tokenStore.save({
      accessToken: "token",
      expiresAt: "2030-01-01T00:00:00Z",
    });
    const provider = new OAuthAuthProvider({ tokenStore });
    await provider.logout();
    const status = await provider.getStatus();
    expect(status.authenticated).toBe(false);
  });

  test("getToken refreshes expired token when refresh token is available", async () => {
    await tokenStore.save({
      accessToken: "expired-token",
      refreshToken: "refresh-123",
      expiresAt: "2020-01-01T00:00:00Z", // expired
    });

    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.grant_type === "refresh_token" && body.refresh_token === "refresh-123") {
        return new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Bad Request", { status: 400 });
    };

    const provider = new OAuthAuthProvider({
      tokenStore,
      fetchFn: mockFetch as typeof fetch,
    });
    const result = await provider.getToken();
    expect(result.token).toBe("new-access-token");

    // Verify the new tokens were persisted
    const stored = await tokenStore.load();
    expect(stored?.accessToken).toBe("new-access-token");
    expect(stored?.refreshToken).toBe("new-refresh-token");
  });

  test("login performs full OAuth flow with browser redirect", async () => {
    let openedUrl: string | null = null;
    const mockOpenBrowser = (url: string) => {
      openedUrl = url;
    };

    // We need to simulate the callback server receiving a code
    // and the token exchange succeeding. This test validates the
    // full wiring by using a mock fetch for the token exchange.
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.grant_type === "authorization_code" && body.code === "test-code") {
        return new Response(
          JSON.stringify({
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 7200,
            user: "oauthuser",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Bad Request", { status: 400 });
    };

    const provider = new OAuthAuthProvider({
      tokenStore,
      openBrowser: mockOpenBrowser,
      fetchFn: mockFetch as typeof fetch,
    });

    // Start login in background — it will start the callback server and wait
    const loginPromise = provider.login();

    // Give the callback server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The openBrowser callback should have been called with the auth URL
    expect(openedUrl).not.toBeNull();
    const authUrl = new URL(openedUrl!);
    expect(authUrl.searchParams.get("client_id")).toBe("app-clawdex");
    expect(authUrl.searchParams.get("response_type")).toBe("code");

    // Extract the redirect_uri from the auth URL and simulate the OAuth callback
    const redirectUri = authUrl.searchParams.get("redirect_uri")!;
    await fetch(`${redirectUri}?code=test-code&state=test-state`);

    // The login should complete successfully
    const result = await loginPromise;
    expect(result).toBe(true);

    // Verify tokens were stored
    const stored = await tokenStore.load();
    expect(stored?.accessToken).toBe("oauth-access-token");
    expect(stored?.refreshToken).toBe("oauth-refresh-token");
    expect(stored?.user).toBe("oauthuser");
  });
});
