import type { IAuthProvider, AuthStatus, AuthToken } from "@clawdex/shared-types";
import { AuthError } from "@clawdex/shared-types";

export class ApiKeyAuthProvider implements IAuthProvider {
  private readonly envVar: string;

  constructor(envVar: string) {
    this.envVar = envVar;
  }

  async getStatus(): Promise<AuthStatus> {
    const key = process.env[this.envVar];
    if (!key) {
      return { authenticated: false };
    }
    return { authenticated: true, method: "api_key" };
  }

  async getToken(): Promise<AuthToken> {
    const key = process.env[this.envVar];
    if (!key) {
      throw new AuthError(
        `API key not found. Set the ${this.envVar} environment variable.`,
      );
    }
    return { token: key };
  }

  async refresh(): Promise<AuthToken> {
    return this.getToken();
  }

  async logout(): Promise<void> {
    // No-op for API key auth — the key is in the environment
  }
}
