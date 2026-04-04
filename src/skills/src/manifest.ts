import { parse as parseTOML } from "smol-toml";
import type { SkillManifest, PluginManifest } from "./types.js";

export function parseSkillManifest(
  content: string,
  format: "toml" | "json",
): SkillManifest | null {
  try {
    const data = format === "toml" ? parseTOML(content) : JSON.parse(content);
    if (!data.id || !data.name || !data.description) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      description: String(data.description),
      version: data.version ? String(data.version) : undefined,
      instructions: data.instructions ? String(data.instructions) : undefined,
      command: data.command ? String(data.command) : undefined,
    };
  } catch {
    return null;
  }
}

export function parsePluginManifest(content: string): PluginManifest | null {
  try {
    const data = JSON.parse(content);
    if (!data.id || !data.name || !data.description) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      description: String(data.description),
      version: data.version ? String(data.version) : undefined,
      skills: data.skills,
      mcpServers: data.mcpServers,
    };
  } catch {
    return null;
  }
}
