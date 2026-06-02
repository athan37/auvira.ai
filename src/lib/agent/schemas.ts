export const businessProfileSchema = {
  "type": "object",
  "required": [
    "businessName",
    "industry",
    "description",
    "services",
    "location",
    "phone",
    "email",
    "mainCTA",
    "brandTone",
    "targetCustomers",
    "problemsWithCurrentSite",
    "recommendedImprovements"
  ],
  "properties": {
    "businessName": { "type": "string" },
    "industry": { "type": "string" },
    "description": { "type": "string" },
    "services": {
      "type": "array",
      "items": { "type": "string" }
    },
    "location": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "string" },
    "mainCTA": { "type": "string" },
    "brandTone": { "type": "string" },
    "targetCustomers": {
      "type": "array",
      "items": { "type": "string" }
    },
    "problemsWithCurrentSite": {
      "type": "array",
      "items": { "type": "string" }
    },
    "recommendedImprovements": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
};

export const siteSpecSchema = {
  "type": "object",
  "required": [
    "siteTitle",
    "tagline",
    "primaryCTA",
    "secondaryCTA",
    "sections",
    "designDirection"
  ],
  "properties": {
    "siteTitle": { "type": "string" },
    "tagline": { "type": "string" },
    "primaryCTA": { "type": "string" },
    "secondaryCTA": { "type": "string" },
    "sections": {
      "type": "array",
      "minItems": 4,
      "maxItems": 16,
      "items": {
        "type": "object",
        "required": ["type", "title", "body", "items"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["hero", "services", "about", "testimonials", "faq", "contact", "booking"]
          },
          "title": { "type": "string" },
          "body": { "type": "string" },
          "items": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "designDirection": {
      "type": "object",
      "required": ["tone", "layout", "colors"],
      "properties": {
        "tone": { "type": "string" },
        "layout": { "type": "string" },
        "colors": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
};

export const editResultSchema = {
  "type": "object",
  "required": ["updatedSiteSpec", "summaryOfChanges"],
  "properties": {
    "updatedSiteSpec": siteSpecSchema,
    "summaryOfChanges": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
};

export const designBriefSchema = {
  "type": "object",
  "required": [
    "brandPersonality",
    "visualStyle",
    "industryTheme",
    "colorPalette",
    "typography",
    "layoutStrategy",
    "sectionTreatments",
    "conversionStrategy",
    "trustSignals",
    "microcopy",
    "animationStyle"
  ],
  "properties": {
    "brandPersonality": { "type": "string" },
    "visualStyle": {
      "type": "string",
      "enum": ["premium-professional", "warm-local", "modern-minimal", "bold-conversion", "calm-healthcare", "luxury-service"]
    },
    "industryTheme": {
      "type": "string",
      "enum": ["legal", "healthcare", "home-services", "restaurant", "beauty", "real-estate", "general-service"]
    },
    "colorPalette": {
      "type": "object",
      "required": ["primary", "secondary", "accent", "background", "surface", "text"],
      "properties": {
        "primary": { "type": "string" },
        "secondary": { "type": "string" },
        "accent": { "type": "string" },
        "background": { "type": "string" },
        "surface": { "type": "string" },
        "text": { "type": "string" }
      }
    },
    "typography": {
      "type": "object",
      "required": ["headlineStyle", "bodyStyle", "fontPairing"],
      "properties": {
        "headlineStyle": { "type": "string" },
        "bodyStyle": { "type": "string" },
        "fontPairing": {
          "type": "string",
          "enum": ["serif-professional", "sans-modern", "editorial-premium"]
        }
      }
    },
    "layoutStrategy": {
      "type": "object",
      "required": ["heroLayout", "sectionDensity", "cardStyle", "ctaPlacement"],
      "properties": {
        "heroLayout": { "type": "string", "enum": ["split-hero", "centered-hero", "editorial-hero", "conversion-hero"] },
        "sectionDensity": { "type": "string", "enum": ["spacious", "balanced", "compact"] },
        "cardStyle": { "type": "string", "enum": ["soft-shadow", "bordered", "glass", "premium-panel"] },
        "ctaPlacement": { "type": "string", "enum": ["hero-heavy", "repeated", "footer-heavy"] }
      }
    },
    "sectionTreatments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["sectionType", "treatment", "notes"],
        "properties": {
          "sectionType": { "type": "string" },
          "treatment": { "type": "string" },
          "notes": { "type": "string" }
        }
      }
    },
    "conversionStrategy": { "type": "array", "items": { "type": "string" } },
    "trustSignals": { "type": "array", "items": { "type": "string" } },
    "microcopy": {
      "type": "object",
      "required": ["primaryCtaLabel", "secondaryCtaLabel", "contactPrompt", "footerTagline"],
      "properties": {
        "primaryCtaLabel": { "type": "string" },
        "secondaryCtaLabel": { "type": "string" },
        "contactPrompt": { "type": "string" },
        "footerTagline": { "type": "string" }
      }
    },
    "animationStyle": { "type": "string", "enum": ["none", "subtle", "premium-subtle"] }
  }
};

export interface BusinessProfile {
  businessName: string;
  industry: string;
  description: string;
  services: string[];
  location: string;
  phone: string;
  email: string;
  mainCTA: string;
  brandTone: string;
  targetCustomers: string[];
  problemsWithCurrentSite: string[];
  recommendedImprovements: string[];
}

export interface SiteSection {
  type: 'hero' | 'services' | 'about' | 'testimonials' | 'faq' | 'contact' | 'booking';
  title: string;
  body: string;
  items: string[];
}

export interface DesignDirection {
  tone: string;
  layout: string;
  colors: string[];
}

export interface SiteSpec {
  siteTitle: string;
  tagline: string;
  primaryCTA: string;
  secondaryCTA: string;
  sections: SiteSection[];
  designDirection: DesignDirection;
}

export interface EditResult {
  updatedSiteSpec: SiteSpec;
  summaryOfChanges: string[];
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface Typography {
  headlineStyle: string;
  bodyStyle: string;
  fontPairing: 'serif-professional' | 'sans-modern' | 'editorial-premium';
}

export interface LayoutStrategy {
  heroLayout: 'split-hero' | 'centered-hero' | 'editorial-hero' | 'conversion-hero';
  sectionDensity: 'spacious' | 'balanced' | 'compact';
  cardStyle: 'soft-shadow' | 'bordered' | 'glass' | 'premium-panel';
  ctaPlacement: 'hero-heavy' | 'repeated' | 'footer-heavy';
}

export interface SectionTreatment {
  sectionType: string;
  treatment: string;
  notes: string;
}

export interface Microcopy {
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  contactPrompt: string;
  footerTagline: string;
}

export interface DesignBrief {
  brandPersonality: string;
  visualStyle: 'premium-professional' | 'warm-local' | 'modern-minimal' | 'bold-conversion' | 'calm-healthcare' | 'luxury-service';
  industryTheme: 'legal' | 'healthcare' | 'home-services' | 'restaurant' | 'beauty' | 'real-estate' | 'general-service';
  colorPalette: ColorPalette;
  typography: Typography;
  layoutStrategy: LayoutStrategy;
  sectionTreatments: SectionTreatment[];
  conversionStrategy: string[];
  trustSignals: string[];
  microcopy: Microcopy;
  animationStyle: 'none' | 'subtle' | 'premium-subtle';
}

// ============================================
// FACTUAL SITE DATA SCHEMA
// ============================================

export const factualSiteDataSchema = {
  "type": "object",
  "required": [
    "businessName",
    "alternateNames",
    "industry",
    "practiceAreasOrServices",
    "people",
    "locations",
    "phoneNumbers",
    "emails",
    "serviceAreas",
    "testimonials",
    "ctas",
    "paymentLinks",
    "socialLinks",
    "sourceFacts",
    "missingCriticalFields",
    "confidence"
  ],
  "properties": {
    "businessName": { "type": "string" },
    "alternateNames": {
      "type": "array",
      "items": { "type": "string" }
    },
    "industry": { "type": "string" },
    "practiceAreasOrServices": {
      "type": "array",
      "items": { "type": "string" }
    },
    "people": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "role", "sourceText"],
        "properties": {
          "name": { "type": "string" },
          "role": { "type": "string" },
          "sourceText": { "type": "string" }
        }
      }
    },
    "locations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label", "address", "sourceText"],
        "properties": {
          "label": { "type": "string" },
          "address": { "type": "string" },
          "sourceText": { "type": "string" }
        }
      }
    },
    "phoneNumbers": {
      "type": "array",
      "items": { "type": "string" }
    },
    "emails": {
      "type": "array",
      "items": { "type": "string" }
    },
    "serviceAreas": {
      "type": "array",
      "items": { "type": "string" }
    },
    "testimonials": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["quote", "sourceText"],
        "properties": {
          "quote": { "type": "string" },
          "sourceText": { "type": "string" }
        }
      }
    },
    "ctas": {
      "type": "array",
      "items": { "type": "string" }
    },
    "paymentLinks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label", "url"],
        "properties": {
          "label": { "type": "string" },
          "url": { "type": "string" }
        }
      }
    },
    "socialLinks": {
      "type": "array",
      "items": { "type": "string" }
    },
    "sourceFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["fact", "sourceUrl"],
        "properties": {
          "fact": { "type": "string" },
          "sourceUrl": { "type": "string" }
        }
      }
    },
    "missingCriticalFields": {
      "type": "array",
      "items": { "type": "string" }
    },
    "confidence": {
      "type": "object",
      "required": ["businessIdentity", "services", "contactInfo", "overall"],
      "properties": {
        "businessIdentity": { "type": "number" },
        "services": { "type": "number" },
        "contactInfo": { "type": "number" },
        "overall": { "type": "number" }
      }
    }
  }
};

export interface FactualSiteData {
  businessName: string;
  alternateNames: string[];
  industry: string;
  practiceAreasOrServices: string[];
  people: Array<{ name: string; role: string; sourceText: string }>;
  locations: Array<{ label: string; address: string; sourceText: string }>;
  phoneNumbers: string[];
  emails: string[];
  serviceAreas: string[];
  testimonials: Array<{ quote: string; sourceText: string }>;
  ctas: string[];
  paymentLinks: Array<{ label: string; url: string }>;
  socialLinks: string[];
  sourceFacts: Array<{ fact: string; sourceUrl: string }>;
  missingCriticalFields: string[];
  confidence: {
    businessIdentity: number;
    services: number;
    contactInfo: number;
    overall: number;
  };
}

export interface ContentFidelityResult {
  /** True when there are no critical fidelity failures (warnings may remain). */
  passed: boolean;
  issues: string[];
  criticalIssues: string[];
  warnIssues: string[];
  hasCriticalFailures: boolean;
  details?: Record<string, string>;
}

// ============================================
// WEBSITE PLAN (SCRATCH MODE) SCHEMA
// ============================================

export const websitePlanSchema = {
  "type": "object",
  "required": ["businessName", "industry", "positioning", "targetCustomers", "primaryGoal", "recommendedPagesOrSections", "contentPlan", "requiredMissingInfo", "optionalMissingInfo", "suggestedTemplate", "riskWarnings"],
  "properties": {
    "businessName": { "type": "string" },
    "industry": { "type": "string" },
    "positioning": { "type": "string" },
    "targetCustomers": { "type": "array", "items": { "type": "string" } },
    "primaryGoal": { "type": "string" },
    "recommendedPagesOrSections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "type", "priority"],
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "priority": { "type": "number" },
          "purpose": { "type": "string" }
        }
      }
    },
    "contentPlan": {
      "type": "object",
      "required": ["hero"],
      "properties": {
        "hero": {
          "type": "object",
          "required": ["headline", "subheadline", "primaryCTA", "secondaryCTA"],
          "properties": {
            "headline": { "type": "string" },
            "subheadline": { "type": "string" },
            "primaryCTA": { "type": "string" },
            "secondaryCTA": { "type": "string" }
          }
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["type", "title", "purpose"],
            "properties": {
              "type": { "type": "string" },
              "title": { "type": "string" },
              "purpose": { "type": "string" },
              "contentNotes": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    },
    "requiredMissingInfo": { "type": "array", "items": { "type": "string" } },
    "optionalMissingInfo": { "type": "array", "items": { "type": "string" } },
    "suggestedTemplate": {
      "type": "object",
      "required": ["category", "variant", "reason"],
      "properties": {
        "category": { "type": "string" },
        "variant": { "type": "string" },
        "reason": { "type": "string" },
        "layoutStarterId": { "type": "string" }
      }
    },
    "riskWarnings": { "type": "array", "items": { "type": "string" } }
  }
};

export interface WebsitePlan {
  businessName: string;
  industry: string;
  positioning: string;
  targetCustomers: string[];
  primaryGoal: string;
  recommendedPagesOrSections: Array<{
    name: string;
    type: string;
    priority: number;
    purpose?: string;
  }>;
  contentPlan: {
    hero: {
      headline: string;
      subheadline: string;
      primaryCTA: string;
      secondaryCTA: string;
    };
    sections?: Array<{
      type: string;
      title: string;
      purpose: string;
      contentNotes?: string[];
    }>;
  };
  requiredMissingInfo: string[];
  optionalMissingInfo: string[];
  suggestedTemplate: {
    category: string;
    variant: string;
    reason: string;
    layoutStarterId?: string;
  };
  riskWarnings: string[];
}

export interface ScratchIntake {
  businessName: string;
  industry: string;
  location: string;
  services: string;
  targetCustomers: string;
  mainGoal: string;
  phone: string;
  email: string;
  address: string;
  desiredStyle: string;
  notes: string;
}

export interface ScratchValidationResult {
  ok: boolean;
  issues: string[];
}