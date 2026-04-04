import { describe, test, expect } from "bun:test";
import { SkillRegistry } from "../src/registry.js";
import type { SkillManifest } from "../src/types.js";

describe("SkillRegistry", () => {
  test("register and get by id", () => {
    const registry = new SkillRegistry();
    const skill: SkillManifest = { id: "test-skill", name: "Test", description: "A test skill" };
    registry.register(skill);
    expect(registry.get("test-skill")).toEqual(skill);
  });

  test("get returns undefined for unknown id", () => {
    expect(new SkillRegistry().get("unknown")).toBeUndefined();
  });

  test("list returns all registered skills", () => {
    const registry = new SkillRegistry();
    registry.register({ id: "a", name: "A", description: "First" });
    registry.register({ id: "b", name: "B", description: "Second" });
    expect(registry.list()).toHaveLength(2);
  });

  test("listInfo returns SkillInfo format", () => {
    const registry = new SkillRegistry();
    registry.register({ id: "my-skill", name: "My Skill", description: "Cool", scope: "global" });
    const infos = registry.listInfo();
    expect(infos).toHaveLength(1);
    expect(infos[0]).toEqual({ id: "my-skill", name: "My Skill", description: "Cool", scope: "global" });
  });

  test("getInstructions aggregates active skill instructions", () => {
    const registry = new SkillRegistry();
    registry.register({ id: "a", name: "A", description: "A", instructions: "Use TypeScript" });
    registry.register({ id: "b", name: "B", description: "B", instructions: "Be concise" });
    registry.register({ id: "c", name: "C", description: "C" });
    const instructions = registry.getInstructions();
    expect(instructions).toContain("TypeScript");
    expect(instructions).toContain("concise");
  });
});
