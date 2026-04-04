import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parsePluginManifest } from "./manifest.js";
import type { PluginManifest } from "./types.js";

export async function discoverPlugins(searchDirs: string[]): Promise<PluginManifest[]> {
  const plugins: PluginManifest[] = [];

  for (const searchDir of searchDirs) {
    try {
      const entries = await readdir(searchDir);
      for (const entry of entries) {
        const pluginDir = join(searchDir, entry);
        const s = await stat(pluginDir).catch(() => null);
        if (!s?.isDirectory()) continue;
        try {
          const content = await readFile(join(pluginDir, "plugin.json"), "utf-8");
          const manifest = parsePluginManifest(content);
          if (manifest) plugins.push(manifest);
        } catch {}
      }
    } catch {}
  }

  return plugins;
}
