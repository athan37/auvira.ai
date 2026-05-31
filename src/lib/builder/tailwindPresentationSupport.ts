/**
 * Canonical Tailwind setup for customer Next.js sites.
 * Single source of truth — generation, validation, and edit repair all use this.
 */

import { promises as fs } from 'fs';
import path from 'path';

/** Scans all app source (siteConfig, page.tsx, components, future folders). */
export const CUSTOMER_SITE_TAILWIND_CONTENT_GLOB = "'./src/**/*.{js,ts,jsx,tsx,mdx}'";

/** Legacy Next.js layouts — kept when normalizing so existing sites do not lose scanned classes. */
export const LEGACY_TAILWIND_CONTENT_GLOBS = [
  "'./src/pages/**/*.{js,ts,jsx,tsx,mdx}'",
  "'./src/components/**/*.{js,ts,jsx,tsx,mdx}'",
  "'./src/app/**/*.{js,ts,jsx,tsx,mdx}'",
] as const;

/** Agent-driven section.presentation and theme edits (runtime class strings). */
export const CUSTOMER_SITE_TAILWIND_SAFELIST = `  safelist: [
    'bg-black',
    'bg-white',
    {
      pattern:
        /^bg-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey|brown)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern:
        /^text-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey|brown|black|white)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern:
        /^border-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey)-(50|100|200|300)$/,
    },
    {
      pattern: /^from-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey)-(50|100|200|300|400|500)$/,
    },
    {
      pattern: /^to-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey)-(50|100|200|300|400|500)$/,
    },
  ],`;

const SHADED_BG_PATTERN =
  /^bg-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey|brown)-(50|100|200|300|400|500|600|700|800|900)$/i;

const FLAT_BG_PATTERN = /^bg-(black|white)$/i;

function isValidGradientStop(part: string): boolean {
  const match = part.match(/^(from|via|to)-(.+)$/i);
  if (!match) return false;
  const token = match[2].toLowerCase();
  if (token === 'black' || token === 'white') return true;
  if (/^(black|white)-\d{2,3}$/.test(token)) return false;
  return /^[a-z]+-\d{2,3}$/.test(token);
}

/** True when a string is a valid Tailwind background utility (emitable by JIT/safelist). */
export function isEmitableTailwindBackgroundClass(className: string): boolean {
  const normalized = className.trim();
  if (!normalized) return false;
  if (FLAT_BG_PATTERN.test(normalized)) return true;
  if (SHADED_BG_PATTERN.test(normalized)) return true;
  if (/^bg-\[[^\]]+\]$/.test(normalized)) return true;
  if (/^bg-gradient-to-[a-z]+(?:-[a-z]+)*$/i.test(normalized.split(/\s+/)[0] ?? '')) {
    const parts = normalized.split(/\s+/);
    if (parts.length < 2) return false;
    return parts.slice(1).every((part) => isValidGradientStop(part));
  }
  return false;
}

/** True when tailwind.config.js can emit a runtime presentation background class. */
export function tailwindConfigCoversBackgroundClass(
  tailwindContent: string,
  className: string
): boolean {
  const normalized = className.trim();
  if (!normalized || !tailwindContent.includes('module.exports')) {
    return false;
  }

  if (!isEmitableTailwindBackgroundClass(normalized)) {
    return false;
  }

  // Full src scan picks up class strings in siteConfig.ts at build/dev time.
  if (tailwindContent.includes('./src/**/*')) {
    return true;
  }

  if (FLAT_BG_PATTERN.test(normalized)) {
    return (
      /\bsafelist\s*:/.test(tailwindContent) &&
      (tailwindContent.includes("'bg-black'") ||
        tailwindContent.includes('"bg-black"') ||
        tailwindContent.includes("'bg-white'") ||
        tailwindContent.includes('"bg-white"') ||
        tailwindContent.includes(normalized))
    );
  }

  if (!/\bsafelist\s*:/.test(tailwindContent)) {
    return false;
  }

  if (SHADED_BG_PATTERN.test(normalized)) {
    const safelistBgPattern =
      /^bg-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey|brown)-(50|100|200|300|400|500|600|700|800|900)$/;
    return safelistBgPattern.test(normalized);
  }

  return tailwindContent.includes(normalized);
}

function buildCanonicalContentBlock(existingContent?: string): string {
  const globs = new Set<string>([...LEGACY_TAILWIND_CONTENT_GLOBS, CUSTOMER_SITE_TAILWIND_CONTENT_GLOB]);
  if (existingContent) {
    const quoted = existingContent.match(/'(\.\/[^']+)'/g) ?? [];
    for (const q of quoted) {
      globs.add(q);
    }
  }
  const lines = [...globs].map((g) => `    ${g},`).join('\n');
  return `  content: [\n${lines}\n  ]`;
}

const CANONICAL_CONTENT_BLOCK = buildCanonicalContentBlock();

/** Body inside module.exports for newly generated customer sites. */
export function tailwindContentPathsForGeneratedSite(): string {
  return `${CANONICAL_CONTENT_BLOCK},
${CUSTOMER_SITE_TAILWIND_SAFELIST}`;
}

/** True when tailwind.config.js already uses full src scan + presentation safelist. */
export function customerSiteTailwindConfigIsComplete(content: string): boolean {
  return content.includes('./src/**/*') && /\bsafelist\s*:/.test(content);
}

/**
 * Force canonical content + safelist on an existing tailwind.config.js (idempotent).
 */
export function normalizeCustomerSiteTailwindConfig(content: string): {
  content: string;
  changed: boolean;
} {
  if (!content.includes('module.exports')) {
    return { content, changed: false };
  }

  let next = content;
  let changed = false;

  const contentMatch = next.match(/content:\s*\[([\s\S]*?)\],?/m);
  const existingInner = contentMatch?.[1] ?? '';
  const needsContentUpgrade =
    !next.includes('./src/**/*') ||
    !LEGACY_TAILWIND_CONTENT_GLOBS.every((g) => next.includes(g.replace(/'/g, '')));
  if (needsContentUpgrade) {
    const block = buildCanonicalContentBlock(existingInner);
    if (contentMatch) {
      next = next.replace(/content:\s*\[[\s\S]*?\],?/m, `${block},`);
    } else {
      next = next.replace(/module\.exports\s*=\s*\{/, `module.exports = {\n${block},`);
    }
    changed = true;
  }

  if (next.includes('],,')) {
    next = next.replace(/\],,/g, '],');
    changed = true;
  }

  if (/\]\s*\n\s*safelist:/.test(next) && !/\],\s*\n\s*safelist:/.test(next)) {
    next = next.replace(/\]\s*\n(\s*safelist:)/, '],\n$1');
    changed = true;
  }

  if (!/\bsafelist\s*:/.test(next)) {
    if (/\btheme\s*:\s*\{/.test(next)) {
      next = next.replace(/\n(\s*theme:\s*\{)/, `\n${CUSTOMER_SITE_TAILWIND_SAFELIST}\n$1`);
    } else {
      const closingBrace = next.lastIndexOf('}');
      if (closingBrace >= 0) {
        const before = next.slice(0, closingBrace).trimEnd();
        const after = next.slice(closingBrace);
        const needsComma = before.length > 0 && !before.endsWith(',') && !before.endsWith('{');
        next = `${before}${needsComma ? ',' : ''}\n${CUSTOMER_SITE_TAILWIND_SAFELIST}\n${after}`;
      }
    }
    changed = true;
  }

  return { content: next, changed };
}

/** @deprecated Use normalizeCustomerSiteTailwindConfig */
export function ensureTailwindScansPresentationClasses(content: string): string | null {
  const { content: next, changed } = normalizeCustomerSiteTailwindConfig(content);
  return changed ? next : null;
}

/**
 * Repair tailwind.config.js in a workspace before build/preview (best-effort).
 */
export async function repairTailwindConfigInWorkspace(
  workspacePath: string
): Promise<boolean> {
  const configPath = path.join(workspacePath, 'tailwind.config.js');
  let before: string;
  try {
    before = await fs.readFile(configPath, 'utf-8');
  } catch {
    return false;
  }

  const { content: after, changed } = normalizeCustomerSiteTailwindConfig(before);
  if (!changed) return false;

  await fs.writeFile(configPath, after, 'utf-8');
  return true;
}
