import type { ITool } from "@clawdex/shared-types";
import { FileReadTool } from "./file-read";
import { FileWriteTool } from "./file-write";
import { ShellTool } from "./shell";
import { ApplyPatchTool } from "./apply-patch";

export interface ToolSchemaEntry {
  name: string;
  description: string;
  parameters: ITool["parameters"];
}

export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  listSchemas(): ToolSchemaEntry[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  static withBuiltins(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(new FileReadTool());
    registry.register(new FileWriteTool());
    registry.register(new ShellTool());
    registry.register(new ApplyPatchTool());
    return registry;
  }
}
