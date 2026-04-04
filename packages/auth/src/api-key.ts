/**
 * ApiKeyAuthProvider — Stub from Phase 1
 *
 * Simple API key authentication. Full implementation will come
 * in Phase 1 Foundation. This is the minimum needed for Phase 6
 * to reference it in the index exports.
 */
import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";

export interface ApiKeyAuthConfig {
  apiKey: string;
}

export class ApiKeyAuthProvider implements IAuthProvider {
  private readonly apiKey: string;

  constructor(config: ApiKeyAuthConfig) {
    this.apiKey = config.apiKey;
  }

  async getToken(): Promise<AuthToken> {
    return { token: this.apiKey, expiresAt: null };
  }

  async getStatus(): Promise<AuthStatus> {
    if (!this.apiKey) {
      return { authenticated: false };
    }
    return { authenticated: true, method: "api_key" };
  }

  async logout(): Promise<void> {
    // No-op for API key auth
  }
}

/** Factory function to create an API key provider from an environment variable. */
export function createAuthProvider(apiKey: string): ApiKeyAuthProvider {
  return new ApiKeyAuthProvider({ apiKey });
}
