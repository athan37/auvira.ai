import Ajv, { type ErrorObject } from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseJsonOutput<T>(raw: string): { ok: true; data: T } | { ok: false; error: string } {
  const jsonText = extractJsonText(raw);
  try {
    return { ok: true, data: JSON.parse(jsonText) as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'JSON parse failed',
    };
  }
}

export function validateAgainstSchema(
  data: unknown,
  schema?: object
): { valid: boolean; errors: ErrorObject[] } {
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const validate = ajv.compile(schema);
  const valid = validate(data);
  return {
    valid: Boolean(valid),
    errors: validate.errors ?? [],
  };
}
