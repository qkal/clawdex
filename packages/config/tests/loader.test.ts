import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, findProjectRoot, mergeConfigs } from "../src/loader";

describe("mergeConfigs", () => {
  test("higher priority scalar wins", () => {
    const base = { model: "gpt-4o", server: { port: 3141 } };
    const override = { model: "gpt-4o-mini" };
    const result = mergeConfigs(base, override);
    expect(result.model).toBe("gpt-4o-mini");
    expect((result.server as { port: number }).port).toBe(3141);
  });

  test("deep merges objects", () => {
    const base = { mcp_servers: { fs: { command: "npx", args: [] } } };
    const override = { mcp_servers: { gh: { command: "gh", args: ["mcp"] } } };
    const result = mergeConfigs(base, override);
    expect((result.mcp_servers as Record<string, { command: string }>).fs.command).toBe("npx");
    expect((result.mcp_servers as Record<string, { command: string }>).gh.command).toBe("gh");
  });

  test("arrays are replaced, not merged", () => {
    const base = { project_root_markers: [".git", "package.json"] };
    const override = { project_root_markers: [".hg"] };
    const result = mergeConfigs(base, override);
    expect(result.project_root_markers).toEqual([".hg"]);
  });
});

describe("findProjectRoot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("finds .git marker", async () => {
    const projectDir = join(tempDir, "project");
    const subDir = join(projectDir, "src", "lib");
    await mkdir(join(projectDir, ".git"), { recursive: true });
    await mkdir(subDir, { recursive: true });
    const root = await findProjectRoot(subDir, [".git", ".clawdex"]);
    expect(root).toBe(projectDir);
  });

  test("finds .clawdex marker", async () => {
    const projectDir = join(tempDir, "project");
    await mkdir(join(projectDir, ".clawdex"), { recursive: true });
    const root = await findProjectRoot(projectDir, [".git", ".clawdex"]);
    expect(root).toBe(projectDir);
  });

  test("returns cwd when no marker found", async () => {
    const root = await findProjectRoot(tempDir, [".nonexistent"]);
    expect(root).toBe(tempDir);
  });
});

describe("loadConfig", () => {
  let tempDir: string;
  let homeDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clawdex-test-"));
    homeDir = join(tempDir, "home");
    projectDir = join(tempDir, "project");
    await mkdir(join(homeDir, ".clawdex"), { recursive: true });
    await mkdir(join(projectDir, ".clawdex"), { recursive: true });
    await mkdir(join(projectDir, ".git"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("loads global config", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o-mini"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
      envOverrides: {},
    });
    expect(config.model).toBe("gpt-4o-mini");
  });

  test("project config overrides global", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o"\n',
    );
    await writeFile(
      join(projectDir, ".clawdex", "config.toml"),
      'model = "gpt-4o-mini"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
      envOverrides: {},
    });
    expect(config.model).toBe("gpt-4o-mini");
  });

  test("works with no config files", async () => {
    const emptyHome = join(tempDir, "empty-home");
    await mkdir(emptyHome, { recursive: true });
    const config = await loadConfig({
      homeDir: emptyHome,
      cwd: projectDir,
      envOverrides: {},
    });
    expect(config.model).toBe("gpt-4o");
  });

  test("CLI overrides take highest priority", async () => {
    await writeFile(
      join(homeDir, ".clawdex", "config.toml"),
      'model = "gpt-4o"\n',
    );
    const config = await loadConfig({
      homeDir,
      cwd: projectDir,
      envOverrides: {},
      cliOverrides: { model: "o1" },
    });
    expect(config.model).toBe("o1");
  });
});
