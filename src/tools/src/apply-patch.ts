import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolResult, ToolContext, ToolSchema } from "@clawdex/shared-types";

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

interface PatchFile {
  oldPath: string | null;
  newPath: string | null;
  hunks: PatchHunk[];
}

function parsePatch(patch: string): PatchFile[] {
  const files: PatchFile[] = [];
  const lines = patch.split("\n");
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("--- ")) {
      const oldPath = lines[i].slice(4).trim();
      i++;
      if (i >= lines.length || !lines[i].startsWith("+++ ")) {
        break;
      }
      const newPath = lines[i].slice(4).trim();
      i++;

      const file: PatchFile = {
        oldPath: oldPath === "/dev/null" ? null : oldPath,
        newPath: newPath === "/dev/null" ? null : newPath,
        hunks: [],
      };

      while (i < lines.length && lines[i].startsWith("@@")) {
        const match = lines[i].match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) break;
        const hunk: PatchHunk = {
          oldStart: parseInt(match[1], 10),
          oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
          lines: [],
        };
        i++;
        while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("--- ")) {
          if (lines[i].startsWith("+") || lines[i].startsWith("-") || lines[i].startsWith(" ")) {
            hunk.lines.push(lines[i]);
          } else if (lines[i] === "") {
            // Empty line at end of patch
          }
          i++;
        }
        file.hunks.push(hunk);
      }

      files.push(file);
    } else {
      i++;
    }
  }

  return files;
}

function applyHunks(original: string, hunks: PatchHunk[]): string {
  const originalLines = original.split("\n");
  // Remove trailing empty line from split if the file ended with newline
  if (originalLines[originalLines.length - 1] === "") {
    originalLines.pop();
  }

  let offset = 0;

  for (const hunk of hunks) {
    const startIndex = hunk.oldStart - 1 + offset;
    const newLines: string[] = [];

    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else if (line.startsWith("-")) {
        // skip removed line
      } else if (line.startsWith(" ")) {
        newLines.push(line.slice(1));
      }
    }

    originalLines.splice(startIndex, hunk.oldCount, ...newLines);
    offset += hunk.newCount - hunk.oldCount;
  }

  return originalLines.join("\n") + "\n";
}

export class ApplyPatchTool implements ITool {
  readonly name = "apply_patch";
  readonly description = "Apply a unified diff patch to files in the working directory.";
  readonly parameters: ToolSchema = {
    type: "object",
    properties: {
      patch: { type: "string", description: "Unified diff patch content" },
    },
    required: ["patch"],
  };

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const startTime = performance.now();
    const patchContent = call.args.patch as string;

    try {
      const files = parsePatch(patchContent);
      if (files.length === 0) {
        return {
          output: "No files found in patch",
          success: false,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      const results: string[] = [];

      for (const file of files) {
        const isCreate = file.oldPath === null && file.newPath !== null;
        const isDelete = file.oldPath !== null && file.newPath === null;
        const isModify = file.oldPath !== null && file.newPath !== null;
        const targetPath = file.newPath ?? file.oldPath!;
        const fullPath = isAbsolute(targetPath) ? targetPath : resolve(ctx.workingDir, targetPath);

        // Check sandbox permissions for write operations
        if (isCreate || isModify) {
          const check = ctx.sandbox.checkFileWrite(fullPath);
          if (!check.allowed) {
            return {
              output: `Permission denied: write not allowed for ${targetPath}. ${check.reason ?? ""}`.trim(),
              success: false,
              durationMs: Math.round(performance.now() - startTime),
            };
          }
        }

        if (isCreate) {
          const newContent = file.hunks
            .flatMap((h) => h.lines.filter((l) => l.startsWith("+")).map((l) => l.slice(1)))
            .join("\n") + "\n";
          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, newContent, "utf-8");
          results.push(`Created ${targetPath}`);
        } else if (isDelete) {
          await unlink(fullPath);
          results.push(`Deleted ${file.oldPath}`);
        } else if (isModify) {
          const original = await readFile(fullPath, "utf-8");
          const modified = applyHunks(original, file.hunks);
          await writeFile(fullPath, modified, "utf-8");
          results.push(`Modified ${targetPath}`);
        }
      }

      return {
        output: results.join("\n"),
        success: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        output: `Failed to apply patch: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
