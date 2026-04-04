import type { ClawdexConfig } from "@clawdex/shared-types";

export const DEFAULT_CONFIG: ClawdexConfig = {
  model: "gpt-4o",
  model_reasoning_effort: "medium",
  model_context_window: 128_000,
  model_auto_compact_token_limit: 0.8,
  developer_instructions: "",
  approval_policy: "on-request",
  sandbox_mode: "workspace-write",
  auth: {
    api_key_env: "OPENAI_API_KEY",
    base_url: "https://api.openai.com/v1",
  },
  server: {
    host: "127.0.0.1",
    port: 3141,
    open_browser: true,
  },
  sandbox: {
    writable_roots: [],
    network_access: false,
  },
  mcp_servers: {},
  memories: {
    enabled: true,
  },
  skills: {
    enabled: true,
    search_paths: [],
  },
  plugins: {
    enabled: true,
  },
  history: {
    enabled: true,
    max_sessions: 100,
    max_session_age_days: 90,
  },
  notify: {
    command: "",
  },
  project_root_markers: [
    ".git",
    ".clawdex",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
  ],
};
