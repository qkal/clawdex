/**
 * @clawdex/shared-types — Stub for Phase 6
 *
 * This is a minimal stub providing only the types needed by the auth
 * and memories packages. The full shared-types package will be built
 * in Phase 1.
 */

// ---- Auth contracts ----

export interface AuthToken {
  token: string;
  expiresAt: string | null;
}

export interface AuthStatus {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  user?: string;
}

export interface IAuthProvider {
  getToken(): Promise<AuthToken>;
  getStatus(): Promise<AuthStatus>;
  logout(): Promise<void>;
}
