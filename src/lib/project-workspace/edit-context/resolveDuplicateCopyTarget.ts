import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { parseSectionTitleCopyEdit } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';

function readQuotedField(content: string, field: string): string | undefined {
  const match = content.match(new RegExp(`\\b${field}\\s*:\\s*["']([^"']*)["']`));
  return match?.[1]?.trim();
}

function readHeroField(content: string, field: 'headline' | 'subheadline' | 'tagline'): string | undefined {
  return readQuotedField(content, field);
}

function readSiteTagline(content: string): string | undefined {
  return readQuotedField(content, 'tagline');
}

export interface DuplicateCopyField {
  field: 'businessName' | 'hero.headline' | 'hero.subheadline' | 'hero.tagline' | 'tagline';
  label: string;
  value: string;
}

export interface DuplicateCopyResolution {
  quotedText?: string;
  fields: DuplicateCopyField[];
  needsClarification: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
}

function extractQuotedText(message: string): string | null {
  const quoted = message.match(/["']([^"']{3,})["']/);
  return quoted?.[1]?.trim() ?? null;
}

/** True when the owner is editing a specific section field (not business/hero duplicate copy). */
export function isSectionScopedCopyEdit(message: string): boolean {
  if (parseSectionTitleCopyEdit(message)) return true;
  if (
    /\b(?:change|update|edit|rename|set)\s+.+\s+section\s+(?:title|headline|text|copy|body)\s+to\b/i.test(
      message
    )
  ) {
    return true;
  }
  if (/\bsection\s+(?:title|headline|text|copy|body)\s+(?:of|for)\s+.+\s+to\b/i.test(message)) {
    return true;
  }
  return false;
}

/** Short bare value after user chose to update both business name and hero. */
export function isBareDuplicateCopyFollowUp(
  message: string,
  history: ConversationTurn[] = []
): boolean {
  const choseBoth = history.some(
    (t) =>
      t.role === 'user' &&
      (/\bboth\b/i.test(t.content) || /business name and hero/i.test(t.content))
  );
  if (!choseBoth) return false;

  const lastAssistant = [...history].reverse().find((t) => t.role === 'assistant');
  if (!lastAssistant?.content.match(/new (text|wording|name|headline|value)/i)) {
    return false;
  }

  const trimmed = message.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length < 120 &&
    !/\b(?:change|update|edit|rename|set)\b/i.test(message) &&
    !/\bsection\b/i.test(message)
  );
}

/** Ambiguous duplicate prompt only for short messages that are not structured edit requests. */
function looksLikeAmbiguousDuplicatePrompt(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length >= 80) return false;
  if (isSectionScopedCopyEdit(message)) return false;
  if (/\b(?:change|update|edit|rename|set|make)\b/i.test(message)) return false;
  if (/\bsection\b/i.test(message)) return false;
  if (/\b(background|color|colour|phone|email|address|image|photo)\b/i.test(message)) {
    return false;
  }
  return true;
}

function collectFieldsWithValue(
  siteConfigContent: string,
  config: NonNullable<ReturnType<typeof parseSiteConfigSource>>,
  text: string
): DuplicateCopyField[] {
  const normalized = text.trim().toLowerCase();
  const matches: DuplicateCopyField[] = [];

  const businessName = config.businessName?.trim();
  if (businessName && businessName.toLowerCase() === normalized) {
    matches.push({ field: 'businessName', label: 'Business name', value: businessName });
  }

  const headline = readHeroField(siteConfigContent, 'headline');
  if (headline && headline.toLowerCase() === normalized) {
    matches.push({ field: 'hero.headline', label: 'Hero headline', value: headline });
  }

  const subheadline = readHeroField(siteConfigContent, 'subheadline');
  if (subheadline && subheadline.toLowerCase() === normalized) {
    matches.push({ field: 'hero.subheadline', label: 'Hero subheadline', value: subheadline });
  }

  const tagline = readSiteTagline(siteConfigContent);
  if (tagline && tagline.toLowerCase() === normalized) {
    matches.push({ field: 'tagline', label: 'Site tagline', value: tagline });
  }

  return matches;
}

/**
 * Detect when the same copy appears in multiple siteConfig fields (e.g. businessName + hero headline).
 */
export function resolveDuplicateCopyTarget(
  siteConfigContent: string,
  message: string,
  conversationHistory: ConversationTurn[] = []
): DuplicateCopyResolution | null {
  if (isSectionScopedCopyEdit(message)) {
    return null;
  }

  const editKind = classifyEditWhat(message);
  if (editKind.startsWith('style_')) {
    return null;
  }

  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed) return null;

  const quoted = extractQuotedText(message);
  const businessName = parsed.businessName?.trim() ?? '';
  const headline = readHeroField(siteConfigContent, 'headline') ?? '';

  if (businessName && headline && businessName === headline) {
    const duplicateFields: DuplicateCopyField[] = [
      { field: 'businessName', label: 'Business name', value: businessName },
      { field: 'hero.headline', label: 'Hero headline', value: headline },
    ];

    if (quoted) {
      const quotedMatches = collectFieldsWithValue(siteConfigContent, parsed, quoted);
      if (quotedMatches.length >= 2) {
        return {
          quotedText: quoted,
          fields: quotedMatches,
          needsClarification: true,
          clarificationMessage: `The text "${quoted}" appears as ${quotedMatches.map((f) => f.label.toLowerCase()).join(' and ')}. Which should I update?`,
          suggestedReplies: [
            'Both the business name and hero headline',
            'Business name only',
            'Hero headline only',
          ],
        };
      }
    }

    if (
      /\bboth\b/i.test(message) ||
      /business name and hero/i.test(message) ||
      /hero headline and business/i.test(message)
    ) {
      return {
        fields: duplicateFields,
        needsClarification: true,
        clarificationMessage:
          'What should the new text be for both the business name and hero headline?',
      };
    }

    if (isBareDuplicateCopyFollowUp(message, conversationHistory)) {
      return { fields: duplicateFields, needsClarification: false };
    }

    if (!quoted && duplicateFields.length >= 2 && looksLikeAmbiguousDuplicatePrompt(message)) {
      return {
        fields: duplicateFields,
        needsClarification: true,
        clarificationMessage: `The same text appears as your business name and hero headline ("${businessName.slice(0, 60)}${businessName.length > 60 ? '…' : ''}"). Which should I update?`,
        suggestedReplies: [
          'Both the business name and hero headline',
          'Business name only',
          'Hero headline only',
        ],
      };
    }
  }

  if (quoted) {
    const quotedMatches = collectFieldsWithValue(siteConfigContent, parsed, quoted);
    if (quotedMatches.length >= 2) {
      return {
        quotedText: quoted,
        fields: quotedMatches,
        needsClarification: true,
        clarificationMessage: `The text "${quoted}" appears in multiple places (${quotedMatches.map((f) => f.label).join(', ')}). Which should I update?`,
        suggestedReplies: quotedMatches.map((f) => f.label).concat(['All of the above']),
      };
    }
  }

  return null;
}
