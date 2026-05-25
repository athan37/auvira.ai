export type SiteSection = {
  type: 'services' | 'about' | 'gallery' | 'generic';
  title: string;
  body?: string;
  items?: Array<{ title: string; description?: string; imageUrl?: string }>;
};

export type SiteConfig = {
  businessName: string;
  hero: { headline: string; subheadline?: string };
  contact: { phone?: string; email?: string };
  sections: SiteSection[];
};

export const siteConfig: SiteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: {},
  sections: [{ type: 'services', title: 'Services', items: [] }],
};
