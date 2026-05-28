export type SiteSection = {
  type: 'services' | 'about' | 'faq' | 'generic';
  title: string;
  body?: string;
  items?: Array<{ title: string; description?: string }>;
};

export type SiteConfig = {
  businessName: string;
  hero: {
    headline: string;
    subheadline?: string;
    ctaLabel?: string;
  };
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  sections: SiteSection[];
};

export const siteConfig: SiteConfig = {
  businessName: 'Houston HVAC Pros',
  hero: {
    headline: 'Trusted HVAC Service in Houston',
    subheadline: 'Family-owned since 1998',
    ctaLabel: 'Call Now',
  },
  contact: {
    phone: '(713) 555-0100',
    email: 'service@houstonhvac.example',
    address: '123 Main St, Houston, TX',
  },
  sections: [
    {
      type: 'services',
      title: 'Our Services',
      items: [
        { title: 'AC Repair', description: 'Fast residential AC repair' },
        { title: 'Heating Maintenance', description: 'Seasonal tune-ups and inspections' },
      ],
    },
    {
      type: 'about',
      title: 'About Us',
      body: 'We are a family-owned HVAC company serving Greater Houston.',
    },
    {
      type: 'faq',
      title: 'Frequently Asked Questions',
      items: [
        {
          title: 'Do you offer emergency service?',
          description: 'Yes — 24/7 emergency HVAC repair.',
        },
        {
          title: 'What areas do you serve?',
          description: 'Houston and surrounding suburbs.',
        },
      ],
    },
  ],
};
