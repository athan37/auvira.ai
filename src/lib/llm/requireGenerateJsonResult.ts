import type { GenerateJSONResult } from './types';

function formatValidationErrors(errors: unknown[] | undefined): string {
  if (!errors?.length) return 'LLM returned invalid or empty JSON.';
  const messages = errors
    .map((entry) => {
      if (entry && typeof entry === 'object' && 'message' in entry) {
        const message = (entry as { message?: unknown }).message;
        return typeof message === 'string' ? message : JSON.stringify(entry);
      }
      return typeof entry === 'string' ? entry : JSON.stringify(entry);
    })
    .filter(Boolean);
  return messages.join('; ') || 'LLM returned invalid or empty JSON.';
}

/**
 * Throws when an LLM JSON call did not return schema-valid data.
 * Surfaces provider/quota errors instead of downstream undefined crashes.
 */
export function requireGenerateJsonResult<T>(
  result: GenerateJSONResult<T>,
  context: string
): T {
  if (result.ok) {
    return result.data;
  }

  const detail = formatValidationErrors(result.validation?.errors);
  throw new Error(`${context} failed: ${detail}`);
}
