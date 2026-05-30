/**
 * Shared rules for post-edit validation when preview uses `next dev` (not production build).
 */

const SOURCE_EXT = /\.(css|scss|sass|less|tsx|jsx|ts|js|json)$/i;

/** True when a changed path is safe to validate with syntax check only (no `next build`). */
export function isPreviewSafeChangedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (
    normalized === 'tailwind.config.js' ||
    normalized === 'tailwind.config.ts' ||
    normalized === 'postcss.config.js' ||
    normalized === 'postcss.config.mjs' ||
    normalized === 'postcss.config.cjs' ||
    normalized === 'next.config.js' ||
    normalized === 'next.config.mjs' ||
    normalized === 'next.config.ts'
  ) {
    return true;
  }
  return normalized.startsWith('src/') && SOURCE_EXT.test(normalized);
}

const LOCK_FILES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

/** Skip production build for source/tailwind-only edits without lockfile changes. */
export function isPreviewSafeEdit(changedFiles: string[]): boolean {
  if (changedFiles.length === 0) return false;
  if (changedFiles.some((f) => LOCK_FILES.has(f.replace(/\\/g, '/')))) return false;
  return changedFiles.every(isPreviewSafeChangedFile);
}
