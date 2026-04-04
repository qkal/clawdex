interface EnvOverrides {
  model?: string;
  sandbox_mode?: string;
  approval_policy?: string;
  server?: { host?: string; port?: number };
  auth?: { base_url?: string };
}

const ENV_MAP: Array<{
  envVar: string;
  path: (value: string) => Partial<EnvOverrides>;
}> = [
  {
    envVar: "CLAWDEX_MODEL",
    path: (v) => ({ model: v }),
  },
  {
    envVar: "CLAWDEX_SANDBOX_MODE",
    path: (v) => ({ sandbox_mode: v }),
  },
  {
    envVar: "CLAWDEX_APPROVAL_POLICY",
    path: (v) => ({ approval_policy: v }),
  },
  {
    envVar: "CLAWDEX_HOST",
    path: (v) => ({ server: { host: v } }),
  },
  {
    envVar: "CLAWDEX_PORT",
    path: (v) => ({ server: { port: parseInt(v, 10) } }),
  },
  {
    envVar: "CLAWDEX_BASE_URL",
    path: (v) => ({ auth: { base_url: v } }),
  },
];

export function resolveEnvOverrides(): Record<string, unknown> {
  let result: Record<string, unknown> = {};

  for (const mapping of ENV_MAP) {
    const value = process.env[mapping.envVar];
    if (value !== undefined && value !== "") {
      const partial = mapping.path(value);
      result = deepMerge(result, partial as Record<string, unknown>);
    }
  }

  return result;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
