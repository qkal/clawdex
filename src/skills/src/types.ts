export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  instructions?: string;
  command?: string;
  scope?: "global" | "project";
  path?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  skills?: SkillManifest[];
  mcpServers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}
