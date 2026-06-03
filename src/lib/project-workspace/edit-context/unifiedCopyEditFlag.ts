/**
 * When enabled, copy edits use resolveConfigTextEdit instead of legacy heuristics.
 * Set WEBSITE_EDIT_UNIFIED_COPY=0 to fall back during migration.
 */
export function isUnifiedCopyEditEnabled(): boolean {
  const value = process.env.WEBSITE_EDIT_UNIFIED_COPY;
  if (value === '0' || value === 'false') return false;
  return true;
}
