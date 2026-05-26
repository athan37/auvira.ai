/** Structured section skeletons for L0/L1 section strategies. */

export function buildFaqSectionSkeleton(itemCount: number): string {
  const n = Math.max(1, Math.min(itemCount, 12));
  const items = Array.from({ length: n }, (_, i) => ({
    title: `Question ${i + 1}?`,
    description: `Answer ${i + 1}.`,
  }));
  const itemsStr = items
    .map(
      (it) =>
        `      { title: '${it.title.replace(/'/g, "\\'")}', description: '${it.description.replace(/'/g, "\\'")}' }`
    )
    .join(',\n');

  return `{
    type: 'faq',
    title: 'Frequently Asked Questions',
    items: [
${itemsStr}
    ]
  }`;
}

export function buildTestimonialsSectionSkeleton(itemCount: number): string {
  const n = Math.max(1, Math.min(itemCount, 8));
  const items = Array.from({ length: n }, (_, i) => ({
    title: `Customer ${i + 1}`,
    description: `Great experience working with this team.`,
  }));
  const itemsStr = items
    .map(
      (it) =>
        `      { title: '${it.title.replace(/'/g, "\\'")}', description: '${it.description.replace(/'/g, "\\'")}' }`
    )
    .join(',\n');

  return `{
    type: 'testimonials',
    title: 'What Our Customers Say',
    items: [
${itemsStr}
    ]
  }`;
}
