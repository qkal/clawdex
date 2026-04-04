import { describe, expect, test } from "bun:test";
import { ToolRegistry } from "../src/registry";
import { FileReadTool } from "../src/file-read";
import { FileWriteTool } from "../src/file-write";
import { ShellTool } from "../src/shell";
import { ApplyPatchTool } from "../src/apply-patch";

describe("ToolRegistry", () => {
  test("registers and retrieves built-in tools", () => {
    const registry = ToolRegistry.withBuiltins();
    expect(registry.get("file_read")).toBeInstanceOf(FileReadTool);
    expect(registry.get("file_write")).toBeInstanceOf(FileWriteTool);
    expect(registry.get("shell")).toBeInstanceOf(ShellTool);
    expect(registry.get("apply_patch")).toBeInstanceOf(ApplyPatchTool);
  });

  test("returns undefined for unknown tool", () => {
    const registry = ToolRegistry.withBuiltins();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  test("lists all tool names", () => {
    const registry = ToolRegistry.withBuiltins();
    const names = registry.listNames();
    expect(names).toContain("file_read");
    expect(names).toContain("file_write");
    expect(names).toContain("shell");
    expect(names).toContain("apply_patch");
    expect(names).toHaveLength(4);
  });

  test("lists all tool schemas", () => {
    const registry = ToolRegistry.withBuiltins();
    const schemas = registry.listSchemas();
    expect(schemas).toHaveLength(4);
    expect(schemas[0]).toHaveProperty("name");
    expect(schemas[0]).toHaveProperty("description");
    expect(schemas[0]).toHaveProperty("parameters");
  });

  test("allows registering custom tools", () => {
    const registry = ToolRegistry.withBuiltins();
    const customTool = new FileReadTool();
    registry.register({ ...customTool, name: "custom_read" } as any);
    expect(registry.get("custom_read")).toBeDefined();
    expect(registry.listNames()).toHaveLength(5);
  });
});
