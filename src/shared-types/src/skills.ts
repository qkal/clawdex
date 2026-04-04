export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  trigger?: string;
  scope: "global" | "project";
  path: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  skills: SkillManifest[];
  mcpServers: PluginMcpServer[];
}

export interface PluginMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SkillRegistry {
  listSkills(workingDirs?: string[]): Promise<SkillManifest[]>;
  getSkill(id: string): Promise<SkillManifest | undefined>;
}
