/**
 * Explorer + intent clarifier for ambiguous pinned-section edits.
 * Set WEBSITE_EDIT_EXPLORER=1 to enable LLM explorer loop (deterministic explorer always runs when pinned).
 */
export function isExplorerEditEnabled(): boolean {
  const value = process.env.WEBSITE_EDIT_EXPLORER;
  return value === '1' || value === 'true';
}

/** Deterministic surface explorer runs when a section is pinned (even without LLM flag). */
export function shouldRunDeterministicExplorer(editContext: {
  selectedTarget?: { kind: string; sectionIndex?: number };
  target: { sectionIndex?: number | null };
}): boolean {
  const pinIndex =
    editContext.selectedTarget?.sectionIndex ?? editContext.target.sectionIndex;
  return pinIndex != null && Number.isFinite(pinIndex);
}
