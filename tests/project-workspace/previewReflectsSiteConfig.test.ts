import { describe, it, expect } from 'vitest';
import {
  expectedBackgroundClassesFromMessage,
  genericColorWouldPassButExactClassMissing,
  htmlContainsExactPresentationClass,
  presentationBackgroundClassesInSiteConfig,
  presentationWiringIssues,
  resolveExpectedPreviewPresentationClasses,
  sectionRendererUsesPresentationResolver,
} from '@/lib/project-workspace/previewReflectsSiteConfig';

const SITE_CONFIG = `export const siteConfig = {
  sections: [
    {
      type: "testimonials",
      title: "Trusted by Over 400,000 Service Professionals",
      presentation: { backgroundClass: "bg-red-200" }
    }
  ]
};`;

describe('previewReflectsSiteConfig', () => {
  it('reads presentation background classes from siteConfig', () => {
    expect(presentationBackgroundClassesInSiteConfig(SITE_CONFIG)).toEqual(['bg-red-200']);
  });

  it('maps owner message color to expected Tailwind class', () => {
    expect(
      expectedBackgroundClassesFromMessage(
        'change background of Trusted by Over 400,000 to red'
      )
    ).toEqual(['bg-red-200']);
  });

  it('prefers siteConfig class over generic color in message', () => {
    expect(
      resolveExpectedPreviewPresentationClasses(
        SITE_CONFIG,
        'change background to yellow',
        0
      )
    ).toEqual(['bg-red-200']);
  });

  it('requires exact Tailwind class, not generic red elsewhere', () => {
    const html =
      '<button class="bg-red-600"></button><p class="text-red-500">red</p>';
    expect(htmlContainsExactPresentationClass(html, 'bg-red-200')).toBe(false);
    expect(
      genericColorWouldPassButExactClassMissing(
        html,
        'change testimonials section background to red',
        ['bg-red-200']
      )
    ).toBe(true);
    expect(htmlContainsExactPresentationClass(`${html} bg-red-200`, 'bg-red-200')).toBe(
      true
    );
  });

  it('detects hardcoded section renderer without resolveSectionBackground', () => {
    const page = `function TestimonialsSection() {
  return <section className={preset.mutedBg} />;
}`;
    expect(sectionRendererUsesPresentationResolver(page, 'TestimonialsSection')).toBe(
      false
    );
    expect(presentationWiringIssues(SITE_CONFIG, page).join(' ')).toContain(
      'TestimonialsSection'
    );
  });
});
