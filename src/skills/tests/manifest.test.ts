import { describe, test, expect } from "bun:test";
import { parseSkillManifest, parsePluginManifest } from "../src/manifest.js";

describe("parseSkillManifest", () => {
  test("parses a valid TOML skill manifest", () => {
    const toml = `
id = "my-skill"
name = "My Skill"
description = "Does cool things"
version = "1.0.0"
instructions = "Always be helpful"
`;
    const result = parseSkillManifest(toml, "toml");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("my-skill");
    expect(result!.name).toBe("My Skill");
    expect(result!.instructions).toBe("Always be helpful");
  });

  test("parses a valid JSON skill manifest", () => {
    const json = JSON.stringify({
      id: "json-skill",
      name: "JSON Skill",
      description: "From JSON",
    });
    const result = parseSkillManifest(json, "json");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("json-skill");
  });

  test("returns null for invalid content", () => {
    expect(parseSkillManifest("not valid", "toml")).toBeNull();
    expect(parseSkillManifest("not json", "json")).toBeNull();
  });

  test("returns null for missing required fields", () => {
    const toml = `name = "Missing ID"`;
    expect(parseSkillManifest(toml, "toml")).toBeNull();
  });
});

describe("parsePluginManifest", () => {
  test("parses a plugin with skills and MCP servers", () => {
    const json = JSON.stringify({
      id: "my-plugin",
      name: "My Plugin",
      description: "A plugin",
      skills: [
        { id: "s1", name: "Skill 1", description: "First skill" },
      ],
      mcpServers: [
        { name: "server1", command: "node", args: ["server.js"] },
      ],
    });
    const result = parsePluginManifest(json);
    expect(result).not.toBeNull();
    expect(result!.skills).toHaveLength(1);
    expect(result!.mcpServers).toHaveLength(1);
  });
});
