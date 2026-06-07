import type { RecordTurnPayload } from './types';

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;

const SENSITIVE_SITE_CONFIG_KEYS = new Set([
  'email',
  'phone',
  'address',
  'businessEmail',
  'businessPhone',
  'contactEmail',
  'contactPhone',
]);

/** Redact emails and phone numbers from free text before sending off-box. */
export function redactPiiText(value: string): string {
  return value.replace(EMAIL_RE, '[REDACTED_EMAIL]').replace(PHONE_RE, '[REDACTED_PHONE]');
}

function redactSiteConfigValue(value: unknown): unknown {
  if (typeof value === 'string') return redactPiiText(value);
  if (Array.isArray(value)) return value.map(redactSiteConfigValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_SITE_CONFIG_KEYS.has(key)) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = redactSiteConfigValue(nested);
    }
    return out;
  }
  return value;
}

/** Build a minimal, redacted siteConfig snapshot for observability POST /turns. */
export function buildRedactedSiteConfigSnapshot(parsedConfig: {
  businessName?: string;
  sections?: Array<{ type?: string; title?: string; items?: unknown[] }>;
} | null | undefined): Record<string, unknown> | null {
  if (!parsedConfig) return null;

  const sections = (parsedConfig.sections ?? []).map((section, index) => ({
    index,
    type: section.type ?? 'unknown',
    title: section.title ? redactPiiText(String(section.title)) : '',
    itemCount: Array.isArray(section.items) ? section.items.length : 0,
  }));

  return {
    businessName: parsedConfig.businessName
      ? redactPiiText(String(parsedConfig.businessName))
      : undefined,
    sectionCount: sections.length,
    sections,
  };
}

/** Apply PII redaction to a turn payload before POST /turns. */
export function redactTurnPayload(payload: RecordTurnPayload): RecordTurnPayload {
  return {
    ...payload,
    user_message: redactPiiText(payload.user_message),
    reply: redactPiiText(payload.reply),
    site_config: payload.site_config
      ? (redactSiteConfigValue(payload.site_config) as Record<string, unknown>)
      : payload.site_config,
  };
}
