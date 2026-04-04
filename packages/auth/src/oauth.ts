import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";
import { TokenStore, type StoredTokens } from "./token-store.js";
import { startCallbackServer } from "./callback-server.js";

export interface OAuthConfig {
  tokenStore: TokenStore;
  /** ChatGPT OAuth authorize URL. */
  authorizeUrl?: string;
  /** ChatGPT OAuth token exchange URL. */
  tokenUrl?: string;
  /** OAuth client ID. */
  clientId?: string;
  /** Function to open a URL in the browser (injected for testing). */
  openBrowser?: (url: string) => void;
  /** Function to perform the token exchange HTTP request (injected for testing). */
  fetchFn?: typeof fetch;
}

const DEFAULT_AUTHORIZE_URL = "https://auth.openai.com/authorize";
const DEFAULT_TOKEN_URL = "https://auth.openai.com/oauth/token";
const DEFAULT_CLIENT_ID = "app-clawdex";

export class OAuthAuthProvider implements IAuthProvider {
  private readonly tokenStore: TokenStore;
  private readonly authorizeUrl: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly openBrowser: ((url: string) => void) | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(opts: OAuthConfig) {
    this.tokenStore = opts.tokenStore;
    this.authorizeUrl = opts.authorizeUrl ?? DEFAULT_AUTHORIZE_URL;
    this.tokenUrl = opts.tokenUrl ?? DEFAULT_TOKEN_URL;
    this.clientId = opts.clientId ?? DEFAULT_CLIENT_ID;
    this.openBrowser = opts.openBrowser;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async getToken(): Promise<AuthToken> {
    const stored = await this.tokenStore.load();
    if (!stored) {
      return { token: "", expiresAt: null };
    }

    // Check if token is expired and try refresh
    if (this.tokenStore.isExpired(stored.expiresAt) && stored.refreshToken) {
      const refreshed = await this.refreshToken(stored.refreshToken);
      if (refreshed) {
        return { token: refreshed.accessToken, expiresAt: refreshed.expiresAt ?? null };
      }
      return { token: "", expiresAt: null };
    }

    return { token: stored.accessToken, expiresAt: stored.expiresAt ?? null };
  }

  async getStatus(): Promise<AuthStatus> {
    const stored = await this.tokenStore.load();
    if (!stored) {
      return { authenticated: false };
    }

    if (this.tokenStore.isExpired(stored.expiresAt) && !stored.refreshToken) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      method: "oauth",
      user: stored.user,
    };
  }

  async refresh(): Promise<AuthToken> {
    const stored = await this.tokenStore.load();
    if (!stored?.refreshToken) {
      throw new AuthError("No refresh token available.");
    }
    const refreshed = await this.refreshToken(stored.refreshToken);
    if (!refreshed) {
      throw new AuthError("Token refresh failed.");
    }
    return { token: refreshed.accessToken };
  }

  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  /**
   * Initiate the full OAuth browser redirect flow.
   * 1. Start callback server on random port
   * 2. Open browser to authorize URL
   * 3. Wait for callback with auth code
   * 4. Exchange code for tokens
   * 5. Store tokens
   */
  async login(): Promise<boolean> {
    const { port, stop, codePromise } = await startCallbackServer();
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const authUrl = new URL(this.authorizeUrl);
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openai.public");

    // Open browser
    if (this.openBrowser) {
      this.openBrowser(authUrl.toString());
    }

    try {
      const code = await codePromise;

      // Exchange code for tokens
      const response = await this.fetchFn(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: this.clientId,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user?: string;
      };

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;

      await this.tokenStore.save({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        user: data.user,
      });

      return true;
    } finally {
      stop();
    }
  }

  private async refreshToken(refreshToken: string): Promise<StoredTokens | null> {
    try {
      const response = await this.fetchFn(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: this.clientId,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user?: string;
      };

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined;

      const tokens: StoredTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt,
        user: data.user,
      };

      await this.tokenStore.save(tokens);
      return tokens;
    } catch {
      return null;
    }
  }
}
