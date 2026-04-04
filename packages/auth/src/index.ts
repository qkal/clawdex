import type { IAuthProvider } from "@clawdex/shared-types";
import { ApiKeyAuthProvider } from "./api-key.js";
import { OAuthAuthProvider } from "./oauth.js";

export { ApiKeyAuthProvider } from "./api-key.js";
export { OAuthAuthProvider } from "./oauth.js";
export type { OAuthConfig } from "./oauth.js";
export { TokenStore } from "./token-store.js";
export type { StoredTokens } from "./token-store.js";
export { startCallbackServer } from "./callback-server.js";
export type { CallbackServerResult } from "./callback-server.js";

export type AuthMethod = "api_key" | "oauth";

export function createAuthProvider(method: AuthMethod, apiKeyEnv?: string): IAuthProvider {
  switch (method) {
    case "api_key":
      return new ApiKeyAuthProvider(apiKeyEnv ?? "OPENAI_API_KEY");
    case "oauth":
      // OAuth requires config — use OAuthAuthProvider directly with a TokenStore
      throw new Error(
        "OAuth provider requires a TokenStore. Use new OAuthAuthProvider({ tokenStore }) directly.",
      );
  }
}
