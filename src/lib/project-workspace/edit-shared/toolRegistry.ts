import type { ToolContext, ToolHandler, ToolResult, WorkspaceProfile } from './types';
import { readFileTool } from './tools/readFile';
import { writeFileTool } from './tools/writeFile';
import { searchFilesTool } from './tools/searchFiles';
import { searchCodeTool } from './tools/searchCode';
import { applyPatchTool } from './tools/applyPatch';
import { validateFilesTool } from './tools/validateFiles';
import { finishTool } from './tools/finish';

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_files: searchFilesTool,
  search_code: searchCodeTool,
  read_file: readFileTool,
  write_file: writeFileTool,
  apply_patch: applyPatchTool,
  validate_files: validateFilesTool,
  finish: finishTool,
};

export function getToolHandler(name: string): ToolHandler | undefined {
  return TOOL_HANDLERS[name];
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  profile: WorkspaceProfile
): Promise<ToolResult> {
  if (!profile.toolNames.includes(toolName)) {
    return { ok: false, error: `Tool not allowed in profile ${profile.id}: ${toolName}` };
  }

  const handler = getToolHandler(toolName);
  if (!handler) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }

  return handler(args, ctx);
}
