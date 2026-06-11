/**
 * Wire contact phone/email/address rows to presentation.cardClass in legacy page.tsx.
 */

const HARDCODED_CONTACT_FIELD_CLASS =
  /className="rounded-2xl border border-white\/10 bg-white\/5 p-4 text-sm text-slate-200"/g;

const CONTACT_FIELD_CLASS_BINDING =
  'className={"rounded-2xl border p-4 text-sm " + resolveContactFieldClass(section, preset)}';

const RESOLVE_CONTACT_FIELD_RUNTIME = `
function resolveContactFieldClass(section: SectionWithPresentation, preset: Record<string, string>): string {
  const cardOverride = section.presentation?.cardClass?.trim();
  if (cardOverride) return cardOverride;
  return preset.contactField ?? "border-white/10 bg-white/5 text-slate-200";
}
`;

/** Replace hardcoded contact field backgrounds with presentation-aware resolver. */
export function repairContactFieldClassInPage(pageContent: string): {
  content: string;
  repaired: boolean;
} {
  let content = pageContent;
  let repaired = false;

  if (HARDCODED_CONTACT_FIELD_CLASS.test(content)) {
    HARDCODED_CONTACT_FIELD_CLASS.lastIndex = 0;
    content = content.replace(HARDCODED_CONTACT_FIELD_CLASS, CONTACT_FIELD_CLASS_BINDING);
    repaired = true;
  }

  if (
    content.includes('resolveContactFieldClass') &&
    !content.includes('function resolveContactFieldClass')
  ) {
    const anchor = 'function resolveSectionEyebrowClass';
    const idx = content.indexOf(anchor);
    if (idx > 0) {
      content =
        content.slice(0, idx) + RESOLVE_CONTACT_FIELD_RUNTIME + '\n' + content.slice(idx);
      repaired = true;
    }
  }

  return {
    content,
    repaired: repaired || content !== pageContent,
  };
}
