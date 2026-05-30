import { classifyEditWhat } from '@/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { extractBackgroundColorFromMessage } from '@/lib/project-workspace/website-edit-agent/preset/presetUtils';
import type { EditContext, VerificationCheck, VerificationContract } from './types';

function parseContactField(message: string): { field: string; value?: string } | null {
  const lower = message.toLowerCase();
  if (/\bphone\b/.test(lower)) {
    const phone = message.match(/\b(?:phone|number)\b[^0-9(+]*([(+][\d\s().-]{7,}|\d[\d\s().-]{6,})/i);
    return { field: 'phone', value: phone?.[1]?.trim() };
  }
  if (/\bemail\b/.test(lower)) {
    const email = message.match(/\b[\w.+-]+@[\w.-]+\.\w+\b/);
    return { field: 'email', value: email?.[0] };
  }
  if (/\baddress\b/.test(lower)) return { field: 'address' };
  return null;
}

function parseHeroField(message: string): string | null {
  const lower = message.toLowerCase();
  if (/\bheadline\b/.test(lower)) return 'headline';
  if (/\bsubheadline\b|\btagline\b/.test(lower)) return 'subheadline';
  return null;
}

/**
 * Build hard source verification checks for the resolved edit context.
 */
export function buildVerificationContract(context: EditContext): VerificationContract {
  const checks: VerificationCheck[] = [];
  const message = context.effectiveMessage;
  const what = classifyEditWhat(message);

  if (what === 'style_background' && context.target.sectionIndex != null) {
    const bgClass =
      extractSectionBackgroundClassFromMessage(message) ??
      (extractBackgroundColorFromMessage(message)
        ? undefined
        : undefined);
    checks.push({
      kind: 'section_background',
      sectionIndex: context.target.sectionIndex,
      expectedValue: bgClass ?? undefined,
    });
  }

  const contactField = parseContactField(message);
  if (contactField) {
    checks.push({
      kind: 'contact_field',
      field: contactField.field,
      expectedValue: contactField.value,
    });
  }

  if (context.target.kind === 'hero') {
    const heroField = parseHeroField(message);
    if (heroField) {
      checks.push({ kind: 'hero_field', field: heroField });
    }
  }

  if (checks.length === 0) {
    checks.push({ kind: 'generic' });
  }

  return { checks };
}
