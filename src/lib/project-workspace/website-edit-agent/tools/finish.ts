import type { ToolContext, ToolResult } from '../types';

export async function finishTool(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolResult> {
  return {
    ok: true,
    summary: String(args.summary || ''),
    ownerMessage: String(args.ownerMessage || 'Changes applied.'),
    terminal: true,
  };
}
