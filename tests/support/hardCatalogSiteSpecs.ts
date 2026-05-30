import type { SyntheticSiteSpec } from './syntheticSiteWorkspace';

/** Site with overlapping titles — mirrors real customer mis-targeting cases. */
export function confusingTitlesSiteSpec(): SyntheticSiteSpec {
  return {
    businessName: 'Hard Catalog Test Site',
    sections: [
      { type: 'services', title: 'Everything You Need to Grow Your Business' },
      { type: 'about', title: 'Everything You Need to Know About Us' },
      { type: 'gallery', title: 'See Our Work in Action' },
      { type: 'testimonials', title: 'What Our Customers Say About Growth' },
      { type: 'contact', title: 'Get Started Today' },
    ],
  };
}

/** Similar verb prefixes — "Get Started" vs "Getting Started". */
export function similarVerbSiteSpec(): SyntheticSiteSpec {
  return {
    businessName: 'Similar Verb Test Site',
    sections: [
      { type: 'services', title: 'Get Started With Our Services' },
      { type: 'about', title: 'About Our Company' },
      { type: 'contact', title: 'Getting Started Today' },
    ],
  };
}
