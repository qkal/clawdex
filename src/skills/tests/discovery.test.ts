import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverSkills } from "../src/discovery.js";

describe("discoverSkills", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "clawdex-skills-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("discovers skills from skill.toml files", async () => {
    const skillDir = join(dir, "my-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "skill.toml"),
      `id = "my-skill"\nname = "My Skill"\ndescription = "Test skill"\n`,
    );
    const skills = await discoverSkills([dir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("my-skill");
    expect(skills[0].path).toBe(skillDir);
  });

  test("discovers skills from skill.json files", async () => {
    const skillDir = join(dir, "json-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "skill.json"),
      JSON.stringify({ id: "json-skill", name: "JSON", description: "From JSON" }),
    );
    const skills = await discoverSkills([dir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("json-skill");
  });

  test("returns empty array for empty directory", async () => {
    const skills = await discoverSkills([dir]);
    expect(skills).toEqual([]);
  });

  test("skips invalid manifests", async () => {
    const skillDir = join(dir, "broken");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "skill.toml"), "invalid toml {{{}");
    const skills = await discoverSkills([dir]);
    expect(skills).toEqual([]);
  });

  test("merges skills from multiple directories", async () => {
    const dir2 = await mkdtemp(join(tmpdir(), "clawdex-skills2-"));
    const s1 = join(dir, "s1");
    const s2 = join(dir2, "s2");
    await mkdir(s1, { recursive: true });
    await mkdir(s2, { recursive: true });
    await writeFile(join(s1, "skill.toml"), `id="s1"\nname="S1"\ndescription="One"\n`);
    await writeFile(join(s2, "skill.toml"), `id="s2"\nname="S2"\ndescription="Two"\n`);
    const skills = await discoverSkills([dir, dir2]);
    expect(skills).toHaveLength(2);
    await rm(dir2, { recursive: true, force: true });
  });
});
