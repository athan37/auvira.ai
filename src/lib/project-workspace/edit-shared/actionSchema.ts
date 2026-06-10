/** JSON schema for structured agent actions (Gemini JSON output). */

export const OWNER_ACTION_SCHEMA = {
  type: 'object',
  required: ['thought', 'action'],
  properties: {
    thought: { type: 'string' },
    action: {
      type: 'object',
      required: ['tool', 'args'],
      properties: {
        tool: { type: 'string' },
        args: { type: 'object' },
      },
    },
  },
};

export const GITLAB_TOOL_NAMES = [
  'search_files',
  'search_code',
  'read_file',
  'write_file',
  'apply_patch',
  'validate_files',
  'finish',
] as const;

export const STATIC_TOOL_NAMES = [
  'read_file',
  'write_file',
  'apply_patch',
  'validate_files',
  'finish',
] as const;
