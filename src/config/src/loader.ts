import { parse as parseTOML } from "smol-toml";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { ClawdexConfig } from "@clawdex/shared-types";
import { ConfigError } from "@clawdex/shared-types";
import { parseConfig } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";
import { resolveEnvOverrides } from "./env";

export function mergeConfigs(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseVal = base[key];
    const overVal = overlay[key];
    if (
      overVal !== null &&
      typeof overVal === "object" &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      result[key] = mergeConfigs(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readTomlFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, "utf-8");
    return parseTOML(content) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(
      `Failed to parse config: ${err instanceof Error ? err.message : String(err)}`,
      path,
    );
  }
}

export async function findProjectRoot(
  cwd: string,
  markers: string[],
): Promise<string> {
  let dir = resolve(cwd);

  while (true) {
    for (const marker of markers) {
      if (await fileExists(join(dir, marker))) {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return cwd;
    }
    dir = parent;
  }
}

export interface LoadConfigOptions {
  homeDir: string;
  cwd: string;
  cliOverrides?: Record<string, unknown>;
  envOverrides?: Record<string, unknown>;
}

export async function loadConfig(options: LoadConfigOptions): Promise<ClawdexConfig> {
  const { homeDir, cwd, cliOverrides, envOverrides } = options;

  // Layer 1: defaults
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG };

  // Layer 2: global config
  const globalPath = join(homeDir, ".clawdex", "config.toml");
  if (await fileExists(globalPath)) {
    const globalConfig = await readTomlFile(globalPath);
    merged = mergeConfigs(merged, globalConfig);
  }

  // Layer 3: project config
  const projectRoot = await findProjectRoot(
    cwd,
    (merged.project_root_markers as string[]) ?? DEFAULT_CONFIG.project_root_markers,
  );
  const projectPath = join(projectRoot, ".clawdex", "config.toml");
  if (await fileExists(projectPath)) {
    const projectConfig = await readTomlFile(projectPath);
    merged = mergeConfigs(merged, projectConfig);
  }

  // Layer 4: environment variable overrides
  const envLayer = envOverrides ?? resolveEnvOverrides();
  if (Object.keys(envLayer).length > 0) {
    merged = mergeConfigs(merged, envLayer);
  }

  // Layer 5: CLI overrides (highest priority)
  if (cliOverrides) {
    merged = mergeConfigs(merged, cliOverrides);
  }

  // Validate final merged config
  const result = parseConfig(merged);
  if (!result.success) {
    const firstError = result.errors.issues[0];
    throw new ConfigError(
      `Invalid config: ${firstError?.path.join(".")} — ${firstError?.message}`,
    );
  }

  return result.data;
}
