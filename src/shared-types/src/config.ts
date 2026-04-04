export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  tools?: Record<string, { approval_mode?: ApprovalPolicy }>;
}

export interface AuthConfig {
  api_key_env: string;
  base_url: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  open_browser: boolean;
}

export interface SandboxConfig {
  writable_roots: string[];
  network_access: boolean;
}

export interface MemoriesConfig {
  enabled: boolean;
}

export interface SkillsConfig {
  enabled: boolean;
  search_paths: string[];
}

export interface PluginsConfig {
  enabled: boolean;
}

export interface HistoryConfig {
  enabled: boolean;
  max_sessions: number;
  max_session_age_days: number;
}

export interface NotifyConfig {
  command: string;
}

export type ApprovalPolicy = "on-request" | "always" | "never";
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ReasoningEffort = "low" | "medium" | "high";

export interface ClawdexConfig {
  model: string;
  model_reasoning_effort: ReasoningEffort;
  model_context_window: number;
  model_auto_compact_token_limit: number;
  developer_instructions: string;
  approval_policy: ApprovalPolicy;
  sandbox_mode: SandboxMode;
  auth: AuthConfig;
  server: ServerConfig;
  sandbox: SandboxConfig;
  mcp_servers: Record<string, McpServerConfig>;
  memories: MemoriesConfig;
  skills: SkillsConfig;
  plugins: PluginsConfig;
  history: HistoryConfig;
  notify: NotifyConfig;
  project_root_markers: string[];
}