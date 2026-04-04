import type { SkillManifest } from "./types.js";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: "global" | "project";
}

export class SkillRegistry {
  private skills = new Map<string, SkillManifest>();

  register(skill: SkillManifest): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillManifest | undefined {
    return this.skills.get(id);
  }

  list(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  listInfo(): SkillInfo[] {
    return this.list().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      scope: s.scope ?? "global",
    }));
  }

  getInstructions(): string {
    const parts: string[] = [];
    for (const skill of this.skills.values()) {
      if (skill.instructions) {
        parts.push(`[${skill.name}] ${skill.instructions}`);
      }
    }
    return parts.join("\n\n");
  }
}
