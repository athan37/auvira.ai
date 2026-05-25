import { getLLMClient } from '@/lib/llm/llmClient';
import { designBriefSchema, type DesignBrief } from './schemas';
import { buildDesignBriefPrompt } from './prompts';

export async function generateDesignBriefAgent(
  businessProfile: Record<string, unknown>,
  siteSpec: Record<string, unknown>,
  sourceUrl: string
): Promise<DesignBrief> {
  const llmClient = getLLMClient();

  const result = await llmClient.generateJSON<DesignBrief>({
    system: "You are a senior web design director and conversion strategist. Create a premium visual design brief for a generated local business website. Return only JSON matching the schema.",
    prompt: buildDesignBriefPrompt(businessProfile, siteSpec, sourceUrl),
    schema: designBriefSchema,
  });

  return result.data;
}

// Default design brief for when LLM fails or no design needed
export function getDefaultDesignBrief(industryTheme: string = 'general-service'): DesignBrief {
  const defaults: Record<string, DesignBrief> = {
    legal: {
      brandPersonality: 'Professional, trustworthy, authoritative',
      visualStyle: 'premium-professional',
      industryTheme: 'legal',
      colorPalette: {
        primary: '#1e3a5f',
        secondary: '#334155',
        accent: '#d97706',
        background: '#f8fafc',
        surface: '#ffffff',
        text: '#1e293b',
      },
      typography: {
        headlineStyle: 'serif-like professional',
        bodyStyle: 'clean readable sans',
        fontPairing: 'serif-professional',
      },
      layoutStrategy: {
        heroLayout: 'split-hero',
        sectionDensity: 'spacious',
        cardStyle: 'premium-panel',
        ctaPlacement: 'hero-heavy',
      },
      sectionTreatments: [],
      conversionStrategy: ['strong phone CTA', 'consultation prompt'],
      trustSignals: ['years of experience', 'licensed attorney'],
      microcopy: {
        primaryCtaLabel: 'Schedule Free Consultation',
        secondaryCtaLabel: 'View Our Services',
        contactPrompt: 'Call us today for a free case evaluation',
        footerTagline: 'Dedicated to protecting your rights',
      },
      animationStyle: 'subtle',
    },
    healthcare: {
      brandPersonality: 'Caring, calm, professional',
      visualStyle: 'calm-healthcare',
      industryTheme: 'healthcare',
      colorPalette: {
        primary: '#0d9488',
        secondary: '#14b8a6',
        accent: '#0891b2',
        background: '#f0fdfa',
        surface: '#ffffff',
        text: '#134e4a',
      },
      typography: {
        headlineStyle: 'friendly professional',
        bodyStyle: 'warm readable',
        fontPairing: 'sans-modern',
      },
      layoutStrategy: {
        heroLayout: 'centered-hero',
        sectionDensity: 'balanced',
        cardStyle: 'soft-shadow',
        ctaPlacement: 'repeated',
      },
      sectionTreatments: [],
      conversionStrategy: ['appointment booking', 'trust badges'],
      trustSignals: ['board certified', 'years of experience'],
      microcopy: {
        primaryCtaLabel: 'Book Appointment',
        secondaryCtaLabel: 'Learn More',
        contactPrompt: 'Call or book online',
        footerTagline: 'Your health is our priority',
      },
      animationStyle: 'subtle',
    },
    'home-services': {
      brandPersonality: 'Reliable, fast, trustworthy',
      visualStyle: 'bold-conversion',
      industryTheme: 'home-services',
      colorPalette: {
        primary: '#0284c7',
        secondary: '#0369a1',
        accent: '#0d9488',
        background: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
      },
      typography: {
        headlineStyle: 'bold clear',
        bodyStyle: 'friendly readable',
        fontPairing: 'sans-modern',
      },
      layoutStrategy: {
        heroLayout: 'conversion-hero',
        sectionDensity: 'compact',
        cardStyle: 'bordered',
        ctaPlacement: 'hero-heavy',
      },
      sectionTreatments: [],
      conversionStrategy: ['prominent phone number', 'emergency CTA', 'service cards'],
      trustSignals: ['licensed and insured', 'local business', 'satisfaction guaranteed'],
      microcopy: {
        primaryCtaLabel: 'Call Now',
        secondaryCtaLabel: 'Get a Quote',
        contactPrompt: 'Available 24/7 for emergencies',
        footerTagline: 'Serving our community for years',
      },
      animationStyle: 'subtle',
    },
    restaurant: {
      brandPersonality: 'Warm, inviting, delicious',
      visualStyle: 'warm-local',
      industryTheme: 'restaurant',
      colorPalette: {
        primary: '#ea580c',
        secondary: '#dc2626',
        accent: '#ca8a04',
        background: '#fffbeb',
        surface: '#ffffff',
        text: '#7c2d12',
      },
      typography: {
        headlineStyle: 'warm appetizing',
        bodyStyle: 'friendly readable',
        fontPairing: 'sans-modern',
      },
      layoutStrategy: {
        heroLayout: 'split-hero',
        sectionDensity: 'balanced',
        cardStyle: 'soft-shadow',
        ctaPlacement: 'repeated',
      },
      sectionTreatments: [],
      conversionStrategy: ['menu highlight', 'reservation CTA', 'hours prominently displayed'],
      trustSignals: ['locally owned', 'fresh ingredients', 'family recipe'],
      microcopy: {
        primaryCtaLabel: 'View Menu',
        secondaryCtaLabel: 'Make Reservation',
        contactPrompt: 'Visit us today',
        footerTagline: 'Taste the difference',
      },
      animationStyle: 'subtle',
    },
  };

  return defaults[industryTheme] || defaults['general-service'];
}
