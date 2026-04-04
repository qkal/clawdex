import { z } from "zod";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { DEFAULT_CONFIG } from "./defaults";

const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
  tools: z.record(z.object({ approval_mode: z.string().optional() })).optional(),
});

export const configSchema = z.object({
  model: z.string().default(DEFAULT_CONFIG.model),
  model_reasoning_effort: z
    .enum(["low", "medium", "high"])
    .default(DEFAULT_CONFIG.model_reasoning_effort),
  model_context_window: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_CONFIG.model_context_window),
  model_auto_compact_token_limit: z
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_CONFIG.model_auto_compact_token_limit),
  developer_instructions: z.string().default(""),
  approval_policy: z
    .enum(["on-request", "always", "never"])
    .default(DEFAULT_CONFIG.approval_policy),
  sandbox_mode: z
    .enum(["read-only", "workspace-write", "danger-full-access"])
    .default(DEFAULT_CONFIG.sandbox_mode),
  auth: z
    .object({
      api_key_env: z.string().default(DEFAULT_CONFIG.auth.api_key_env),
      base_url: z.string().url().default(DEFAULT_CONFIG.auth.base_url),
    })
    .default({}),
  server: z
    .object({
      host: z.string().default(DEFAULT_CONFIG.server.host),
      port: z.number().int().min(0).max(65535).default(DEFAULT_CONFIG.server.port),
      open_browser: z.boolean().default(DEFAULT_CONFIG.server.open_browser),
    })
    .default({}),
  sandbox: z
    .object({
      writable_roots: z.array(z.string()).default([]),
      network_access: z.boolean().default(false),
    })
    .default({}),
  mcp_servers: z.record(mcpServerSchema).default({}),
  memories: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  skills: z
    .object({
      enabled: z.boolean().default(true),
      search_paths: z.array(z.string()).default([]),
    })
    .default({}),
  plugins: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
  history: z
    .object({
      enabled: z.boolean().default(true),
      max_sessions: z.number().int().positive().default(100),
      max_session_age_days: z.number().int().positive().default(90),
    })
    .default({}),
  notify: z
    .object({
      command: z.string().default(""),
    })
    .default({}),
  project_root_markers: z
    .array(z.string())
    .default(DEFAULT_CONFIG.project_root_markers),
});

export type ParseResult =
  | { success: true; data: ClawdexConfig }
  | { success: false; errors: z.ZodError };

export function parseConfig(raw: unknown): ParseResult {
  const result = configSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as ClawdexConfig };
  }
  return { success: false, errors: result.error };
}
