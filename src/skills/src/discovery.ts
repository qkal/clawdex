import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SkillManifest } from "./types.js";
import { parseSkillManifest } from "./manifest.js";

export async function discoverSkills(searchDirs: string[]): Promise<SkillManifest[]> {
  const skills: SkillManifest[] = [];

  for (const searchDir of searchDirs) {
    try {
      const entries = await readdir(searchDir);
      for (const entry of entries) {
        const skillDir = join(searchDir, entry);
        const s = await stat(skillDir).catch(() => null);
        if (!s?.isDirectory()) continue;
        const manifest = await tryLoadManifest(skillDir);
        if (manifest) {
          manifest.path = skillDir;
          skills.push(manifest);
        }
      }
    } catch {
      // Directory doesn't exist or inaccessible
    }
  }

  return skills;
}

async function tryLoadManifest(skillDir: string): Promise<SkillManifest | null> {
  try {
    const content = await readFile(join(skillDir, "skill.toml"), "utf-8");
    const manifest = parseSkillManifest(content, "toml");
    if (manifest) return manifest;
  } catch {}

  try {
    const content = await readFile(join(skillDir, "skill.json"), "utf-8");
    const manifest = parseSkillManifest(content, "json");
    if (manifest) return manifest;
  } catch {}

  return null;
}
