export interface AuthStatus {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  user?: string;
}

export interface AuthToken {
  token: string;
  expiresAt?: Date;
}

export interface IAuthProvider {
  getStatus(): Promise<AuthStatus>;
  getToken(): Promise<AuthToken>;
  refresh(): Promise<AuthToken>;
  logout(): Promise<void>;
}
