import { hasExplicitEditTarget } from '../enrichEditPrompt';
import { extractExplicitTargetValue } from './copyFieldStrategy';
import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function detectContactField(message: string): 'phone' | 'email' | 'address' | null {
  const lower = message.toLowerCase();
  if (/\bphone\b/.test(lower)) return 'phone';
  if (/\bemail\b/.test(lower)) return 'email';
  if (/\baddress\b/.test(lower)) return 'address';
  return null;
}

/**
 * L0: patch siteConfig.contact phone/email/address.
 */
export async function runContactFieldStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab' || !hasExplicitEditTarget(options.ownerMessage)) {
    return null;
  }

  const field = detectContactField(options.ownerMessage);
  const value = extractExplicitTargetValue(options.ownerMessage);
  if (!field || !value) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const fieldRe = new RegExp(`(${field}\\s*:\\s*)(['"])([^'"]*)\\2`, 'i');
  let updated = content;

  if (fieldRe.test(content)) {
    updated = content.replace(fieldRe, `$1'${escaped}'`);
  } else if (/contact\s*:\s*\{/.test(content)) {
    updated = content.replace(
      /contact\s*:\s*\{/,
      `contact: {\n    ${field}: '${escaped}',`
    );
  } else {
    return null;
  }

  if (updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'contact_field',
    'L0',
    `Updated ${field} to ${value}.`,
    { confidence: 'high' }
  );
}
