import { formatConversationForIntentClarifier, type ConversationTurn } from './editAmbiguity';
import {
  formatSectionCatalogForClarifier,
  formatSectionCatalogForPrompt,
} from './siteSectionCatalog';
import { formatEditTargetPlanForPrompt } from './buildGroundedEditContext';
import type { EditIntent, EditTargetPlan } from './types';
import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import type { WorkspaceGateway } from '../workspaceGateway';
import {
  discoverContextFiles,
  loadContextFileContents,
  PRIORITY_CONTEXT_FILES,
} from './discoverContextFiles';

export interface EnrichedEditPrompt {
  /** Full instruction block for the agent (includes context + task). */
  agentPrompt: string;
  /** Original owner message (unchanged). */
  originalMessage: string;
  contextFiles: string[];
}

const MAX_CONTEXT_CHARS = 24_000;

/** Owner gave a concrete target value (e.g. "to Built for Houston" or "to: Built for Houston"). */
export function hasExplicitEditTarget(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\bto\s+["'].+["']/.test(message)) return true;
  if (/\bto\s*:?\s+[A-Za-z0-9][\w\s,'-]{2,}/.test(message)) return true;
  if (/\b(set|make|update)\s+.+\s+(to|as)\s+/i.test(message)) return true;
  if (lower.includes('faq') && /\d+/.test(message)) return true;
  return false;
}

function extractHeroHeadline(context: Record<string, string>): string | null {
  const siteConfig = context['src/lib/siteConfig.ts'] || '';
  const page = context['src/app/page.tsx'] || '';

  const fromConfig =
    siteConfig.match(/headline:\s*['"]([^'"]+)['"]/i)?.[1] ||
    siteConfig.match(/headline:\s*`([^`]+)`/i)?.[1];
  if (fromConfig) return fromConfig.trim();

  const fromPage =
    page.match(/headline:\s*['"]([^'"]+)['"]/i)?.[1] ||
    page.match(/>\s*([^<]{4,80})\s*<\/h1>/i)?.[1];
  if (fromPage) return fromPage.trim();

  return null;
}

function analyzeSiteStructure(context: Record<string, string>) {
  const siteConfig = context['src/lib/siteConfig.ts'] || '';
  const page = context['src/app/page.tsx'] || '';

  return {
    hasFaqSection: /["']faq["']/.test(siteConfig) && /type:\s*['"]faq['"]|"type":\s*"faq"/.test(siteConfig),
    hasTestimonialsSection:
      /["']testimonials["']/.test(siteConfig) &&
      /type:\s*['"]testimonials['"]|"type":\s*"testimonials"/.test(siteConfig),
    hasFaqRenderer: /FaqSection|case\s*["']faq["']/.test(page),
    hasTestimonialsRenderer: /TestimonialsSection|case\s*["']testimonials["']/.test(page),
    rendersFromSiteConfig: /siteConfig\.sections/.test(page),
  };
}

function buildSectionGuidance(
  originalMessage: string,
  context: Record<string, string>
): string[] {
  const lower = originalMessage.toLowerCase();
  const structure = analyzeSiteStructure(context);
  const lines: string[] = [];

  lines.push(
    'SECTION ADD/UPDATE — follow this architecture (do not skip write_file):'
  );
  lines.push(
    'IMPORTANT: If similar content already exists, you must STILL write_file updated files — existing content does not fulfill a new owner request.'
  );
  lines.push(
    '1. Homepage content lives in src/lib/siteConfig.ts under siteConfig.sections (array of { type, title, subtitle?, body?, items?, presentation? }).'
  );
  lines.push(
    '2. src/app/page.tsx maps siteConfig.sections to React section components (faq, testimonials, etc.).'
  );

  if (structure.rendersFromSiteConfig) {
    lines.push(
      '3. This site already renders sections from siteConfig — update src/lib/siteConfig.ts with write_file (full file content). page.tsx usually does NOT need changes unless a renderer is missing.'
    );
  } else {
    lines.push(
      '3. You MUST write_file BOTH src/lib/siteConfig.ts (section data) AND src/app/page.tsx (render the new section on the homepage).'
    );
  }

  lines.push(
    '4. FAQ items: use item.title for the question (include "?") and item.description for the answer.'
  );
  lines.push(
    '5. Testimonial items: use item.title for the customer name and item.description for the quote text.'
  );
  lines.push('6. Do not invent phone numbers or street addresses.');
  lines.push(
    '7. Per-section colors/cards: set siteConfig.sections[i].presentation (backgroundClass, cardClass, titleClass, etc.). Example: presentation: { backgroundClass: "bg-yellow-200" }. Never use subtitle for style markers (no YELLOW_BG). page.tsx usually does not need changes when presentation is set.'
  );

  if (lower.includes('faq')) {
    const countMatch = originalMessage.match(/\b(\d+)\b/);
    const count = countMatch ? Number(countMatch[1]) : 3;
    if (structure.hasFaqSection) {
      lines.push(
        `Add or update the FAQ section in siteConfig.sections with exactly ${count} Q&A pairs (items array).`
      );
    } else {
      lines.push(
        `Append a new section to siteConfig.sections: { type: "faq", title: "...", items: [${count} pairs with title + description] }.`
      );
    }
    if (!structure.hasFaqRenderer) {
      lines.push(
        'page.tsx is missing an FAQ renderer — add FaqSection (or extend the section switch) and ensure it appears in the homepage render.'
      );
    }
  }

  if (lower.includes('testimonial') || lower.includes('review') || lower.includes('quote')) {
    const countMatch = originalMessage.match(/\b(\d+)\b/);
    const count = countMatch ? Number(countMatch[1]) : 2;
    if (structure.hasTestimonialsSection) {
      lines.push(
        `A testimonials section ALREADY EXISTS — update that section in siteConfig.sections: set items to exactly ${count} short customer quotes (title=customer name, description=quote). You MUST write_file the full siteConfig.ts even though testimonials exist.`
      );
    } else {
      lines.push(
        `Append a new section: { type: "testimonials", title: "...", items: [${count} entries with title=name, description=quote] }.`
      );
    }
    if (!structure.hasTestimonialsRenderer) {
      lines.push(
        'page.tsx is missing a testimonials renderer — add TestimonialsSection and wire it in the section switch.'
      );
    }
  }

  if (!lower.includes('faq') && !lower.includes('testimonial')) {
    lines.push(
      'Append or update a section in siteConfig.sections so the new copy is visible on the homepage.'
    );
  }

  lines.push(
    'REQUIRED: call write_file on src/lib/siteConfig.ts with the complete updated file before finish.'
  );

  return lines;
}

function buildIntentGuidance(
  intent: EditIntent,
  originalMessage: string,
  context: Record<string, string>
): string {
  const lower = originalMessage.toLowerCase();
  const vague = !hasExplicitEditTarget(originalMessage);
  const lines: string[] = [];

  lines.push('You MUST call write_file (or apply_patch) to change at least one file before finish.');
  lines.push('Prefer src/lib/siteConfig.ts for copy/headlines when present; also update src/app/page.tsx if it renders duplicate text.');

  if (intent === 'copy' || lower.includes('headline') || lower.includes('hero')) {
    const current = extractHeroHeadline(context);
    if (vague) {
      lines.push(
        'The owner did not specify exact new text. Choose a clear, professional headline that fits the existing business (do not invent phone, address, or reviews).'
      );
      if (current) {
        lines.push(`Current hero headline appears to be: "${current}". Replace it with an improved headline.`);
      } else {
        lines.push('Find the hero headline in siteConfig or page.tsx and update it.');
      }
    } else if (current) {
      lines.push(`Current hero headline: "${current}". Apply the owner’s requested new text.`);
    }
  }

  if (
    intent === 'section' ||
    lower.includes('section') ||
    lower.includes('faq') ||
    lower.includes('testimonial')
  ) {
    lines.push(...buildSectionGuidance(originalMessage, context));
  }

  if (intent === 'contact') {
    lines.push('Only use contact details already present in the site — do not invent phone numbers or addresses.');
  }

  if (intent === 'style') {
    lines.push(
      'Site-wide theme: update preset colors in src/app/page.tsx and globals.css. One section only: set siteConfig.sections[i].presentation.backgroundClass (Tailwind class, e.g. bg-yellow-200) — do not patch GallerySection JSX or put colors in subtitle.'
    );
  }

  return lines.join('\n');
}

export function buildImageAttachmentGuidance(attachments: WorkspaceAssetAttachment[]): string {
  if (attachments.length === 0) return '';

  const lines = [
    'OWNER ATTACHED IMAGES (already saved in the website project — use these paths on the live site):',
  ];

  for (const asset of attachments) {
    lines.push(
      `- "${asset.originalName}" → use src="${asset.publicUrl}" (workspace file: ${asset.path})`
    );
  }

  lines.push(
    'Place images where the owner asked (hero, about section, gallery, logo, etc.). Prefer updating src/lib/siteConfig.ts with imageUrl fields when adding section images, then render with <img> or next/image in src/app/page.tsx.'
  );
  lines.push(
    'For hero background or side image: update the Hero component in page.tsx to show <img src="..." alt="..." className="..." /> with sensible layout (object-cover, rounded corners, max height).'
  );
  lines.push('Do not hotlink external URLs when these uploaded images are provided.');

  return lines.join('\n');
}

function formatContextBlock(context: Record<string, string>): string {
  const parts: string[] = [];
  let total = 0;

  const order = [
    ...PRIORITY_CONTEXT_FILES.filter((f) => context[f]),
    ...Object.keys(context).filter((f) => !PRIORITY_CONTEXT_FILES.includes(f)),
  ];

  for (const rel of order) {
    const body = context[rel];
    if (!body) continue;
    const chunk = `### ${rel}\n\`\`\`\n${body}\n\`\`\``;
    if (total + chunk.length > MAX_CONTEXT_CHARS) {
      parts.push(`### ${rel}\n(file omitted — too large; use read_file)`);
      continue;
    }
    parts.push(chunk);
    total += chunk.length;
  }

  return parts.join('\n\n');
}

/**
 * Combine owner message with a snapshot of relevant site files and explicit task guidance.
 */
async function loadContextViaGateway(
  gateway: WorkspaceGateway,
  paths: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const maxBytes = 12_000;
  for (const rel of paths) {
    try {
      const content = await gateway.readFile(rel);
      out[rel] =
        content.length <= maxBytes
          ? content
          : `${content.slice(0, maxBytes)}\n/* … truncated … */`;
    } catch {
      /* missing */
    }
  }
  return out;
}

export async function enrichEditPrompt(
  workspacePath: string,
  mode: 'gitlab' | 'static',
  ownerMessage: string,
  intent: EditIntent,
  attachments: WorkspaceAssetAttachment[] = [],
  gateway?: WorkspaceGateway,
  conversationHistory?: ConversationTurn[],
  editTargetPlan?: EditTargetPlan
): Promise<EnrichedEditPrompt> {
  const paths = await discoverContextFiles(workspacePath, mode, ownerMessage);
  const context = gateway
    ? await loadContextViaGateway(gateway, paths)
    : await loadContextFileContents(workspacePath, paths);
  const contextBlock = formatContextBlock(context);
  const guidance = buildIntentGuidance(intent, ownerMessage, context);
  const imageGuidance = buildImageAttachmentGuidance(attachments);

  const catalog = editTargetPlan?.sectionCatalog;
  const catalogClarifier = catalog ? formatSectionCatalogForClarifier(catalog) : undefined;
  const historyBlock = formatConversationForIntentClarifier(
    ownerMessage.trim(),
    conversationHistory,
    catalogClarifier
  );

  const targetLock =
    editTargetPlan?.where.sectionIndex != null
      ? `TARGET LOCK: sections[${editTargetPlan.where.sectionIndex}] "${editTargetPlan.where.title ?? ''}" — do not edit a different section.\n\n`
      : '';

  const groundedBlock = editTargetPlan
    ? `${targetLock}${formatEditTargetPlanForPrompt(editTargetPlan)}\n\n`
    : catalog
      ? `${formatSectionCatalogForPrompt(catalog)}\n\n`
      : '';

  const agentPrompt = `${historyBlock}${groundedBlock}OWNER REQUEST (exact words from customer):
"${ownerMessage.trim()}"
${imageGuidance ? `\n${imageGuidance}\n` : ''}
CURRENT WEBSITE FILES (snapshot — use read_file to confirm before writing):
${contextBlock || '(no context files found — use search_files and read_file first)'}

TASK:
${guidance}
${editTargetPlan ? 'Prefer editing the EXTRACTED CODE regions above — they are the resolved edit targets.' : ''}
${imageGuidance ? '\nYou MUST reference the uploaded image URL(s) in the updated site files.' : ''}

Apply the owner request by editing the real source files above. Do not call finish until at least one file is written.`;

  return {
    agentPrompt,
    originalMessage: ownerMessage,
    contextFiles: Object.keys(context),
  };
}
