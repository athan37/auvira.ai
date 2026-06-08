export const extractBusinessProfilePrompt = {
  system: "You are a website migration analyst. Extract factual business information from crawled website text. Return only structured JSON matching the schema. If a field is missing, use an empty string or empty array. Do not invent phone/email/location if missing. CRITICAL: You must identify the business name — it is typically found in the page title, meta og:title, h1 heading, or footer/copyright. Check carefully and extract the exact business name.",
  promptTemplate: `Extract business information from the following website content.

Source URL: {sourceUrl}

Page titles:
{pageTitles}

Signals detected during crawl (use these to cross-reference the business name):
{signalsSummary}

Content from crawled pages:
{pageTexts}

Optional user instructions: {instruction}

Return a valid JSON object matching this schema:
{
  "businessName": string,
  "industry": string,
  "description": string,
  "services": string[],
  "location": string,
  "phone": string,
  "email": string,
  "mainCTA": string,
  "brandTone": string,
  "targetCustomers": string[],
  "problemsWithCurrentSite": string[],
  "recommendedImprovements": string[]
}`
};

export const generateSiteSpecPrompt = {
  system: `You are a website modernization agent. You may improve structure, clarity, visual hierarchy, and CTA wording, but you MUST preserve factual accuracy.

Rules:
- siteTitle must match the factual business name from factualSiteData.
- If original is a family law firm, generated site must remain a family law firm.
- Do not introduce unrelated practice areas.
- Do not invent testimonials.
- Do not invent contact info (phone, email, address).
- Do not invent awards, credentials, years of experience, or guarantees unless present in sourceFacts.
- Use only factualSiteData.businessName, industry, practiceAreasOrServices, locations, phoneNumbers, emails, testimonials as source of truth.
- For body copy that needs filler, keep it generic and non-factual: "We provide clear guidance and personalized support throughout your matter."
- Do NOT use: "thousands of successful cases", "A+ BBB rated", "15 years experience" unless explicitly in sourceFacts.
- Never change the industry or business type.

Return only JSON matching the schema.`,
  promptTemplate: `Create a modern one-page website plan based on this factual data:

FACTUAL DATA (use ONLY these values - do not change them):
- Business Name: {factualBusinessName}
- Industry: {factualIndustry}
- Practice Areas: {factualPracticeAreas}
- Locations: {factualLocations}
- Phone Numbers: {factualPhones}
- Emails: {factualEmails}
- Service Areas: {factualServiceAreas}
- Testimonials: {factualTestimonials}

Business Profile (LLM may enhance copy but must preserve facts):
- Description: {description}
- Main CTA: {mainCTA}
- Brand Tone: {brandTone}

User Instructions: {instruction}

Return a valid JSON object matching this schema:
{
  "siteTitle": string,
  "tagline": string,
  "primaryCTA": string,
  "secondaryCTA": string,
  "sections": [
    {
      "type": "hero" | "services" | "about" | "testimonials" | "faq" | "contact" | "booking",
      "title": string,
      "body": string,
      "items": string[]
    }
  ],
  "designDirection": {
    "tone": string,
    "layout": string,
    "colors": string[]
  }
}

CRITICAL:
- siteTitle MUST contain the business name "{factualBusinessName}" or major words from it.
- Services must be from: {factualPracticeAreas}
- Contact info must be from: {factualPhones}, {factualEmails}
- Do NOT use immigration terms if industry is family law.
- Do NOT invent content not in the factual data.`
};

export const applyEditPrompt = {
  system: "You are an AI website maintenance agent for a small business website. Update the site spec based on the user's edit request. Be practical - add useful sections and content, not overly verbose copy. Preserve the existing business identity, services, and contact info unless asked to change them.",
  promptTemplate: `Update the existing site spec according to the user's edit request.

User Edit Request: {editRequest}

Current Site Spec:
{currentSiteSpec}

Return a valid JSON object matching this schema:
{
  "updatedSiteSpec": {
    "siteTitle": string,
    "tagline": string,
    "primaryCTA": string,
    "secondaryCTA": string,
    "sections": [...],
    "designDirection": {...}
  },
  "summaryOfChanges": string[]
}

Rules:
- ALWAYS keep at least 4 sections. Preserve existing sections - ADD new sections rather than replacing.
- For simple feature requests (FAQ, pricing, booking CTA, testimonials), ADD a new section to existing ones.
- For content updates (phone, hours, services), UPDATE only the relevant section.
- For visual/style requests (change colors, background, theme, tone, fonts), UPDATE designDirection.colors with valid CSS hex only (e.g. "#FF0000", "#0284C7") — no color names or prose in the array.
- For hero headline/copy changes, update the hero section title (headline) and/or siteTitle so they stay in sync.
- For complex requests (booking backend, login, payments, CRM), add a placeholder CTA section.
- Do not invent contact info, hours, or pricing unless provided by user.
- Keep copy concise and actionable.
- sections.type can be: hero, services, about, testimonials, faq, contact, booking, pricing, team`
};

export function buildExtractProfilePrompt(
  sourceUrl: string,
  pageTitles: string[],
  pageTexts: string[],
  instruction?: string,
  signalsSummary?: string
): string {
  return extractBusinessProfilePrompt.promptTemplate
    .replace('{sourceUrl}', sourceUrl)
    .replace('{pageTitles}', pageTitles.join('\n'))
    .replace('{pageTexts}', pageTexts.join('\n\n'))
    .replace('{instruction}', instruction || 'None provided')
    .replace('{signalsSummary}', signalsSummary || '(no signals detected during crawl)');
}

// Template structural requirements injected into site spec generation
const TEMPLATE_REQUIREMENTS: Record<string, string> = {
  legal: `
TEMPLATE: You are generating a PREMIUM LAW FIRM website.
STRUCTURAL REQUIREMENTS:
- Hero: Professional split layout (headline/tagline/CTA left, contact card right). NEVER use phone-first hero.
- Above the fold: Credibility bar with "50+ Years Experience | Free Consultations | 10,000+ Cases"
- Section order: hero → credibility-bar → practice-areas → about/firm reputation → testimonials → contact → consultation CTA
- CTAs: "Free Consultation" prominent in hero, repeated after each practice area, and in footer
- Trust signals: credentials, awards (only if factual), years of experience (only if factual)
- About/firm section: attorney profiles or firm reputation paragraph
- Contact: consultation form or prominent phone/email with consultation CTA`,
  healthcare: `
TEMPLATE: You are generating a CLINICAL HEALTHCARE website.
STRUCTURAL REQUIREMENTS:
- Hero: Centered appointment-hero layout with "Book Appointment" as most prominent CTA
- Phone and address visible above the fold
- Section order: hero → providers/staff → services → insurance/payment → about → contact
- Provider/staff section: doctor names or "Meet Our Team" with credentials (only factual)
- Insurance: accepted insurance plans or payment info (only factual)
- Trust signals: board certifications, years in practice (only factual)
- Calm, clinical visual feel with trust emphasis`,
  'home-services': `
TEMPLATE: You are generating a HOME SERVICES / CONTRACTOR website.
STRUCTURAL REQUIREMENTS:
- Hero: PHONE-FIRST layout — phone number must be huge and above fold with click-to-call
- "24/7 Emergency Service" banner immediately below nav
- Section order: hero (phone-first) → emergency-banner → services (icon cards) → why-choose-us → reviews → service-area → contact → quote-form
- Phone CTA in nav AND hero, both click-to-call
- Service area section: list of zip codes or neighborhoods served
- Quote/request form section with fields
- Trust: "Licensed & Insured", "Same-Day Service", local reviews`,
  restaurant: `
TEMPLATE: You are generating a RESTAURANT / HOSPITALITY website.
STRUCTURAL REQUIREMENTS:
- Hero: Menu-feature layout — left side text, right side food imagery placeholder
- Hours and location MUST be prominent (in hero or immediately after)
- Section order: hero → hours-location → menu/dishes → about → gallery → contact
- Inline CTAs: "Reserve Table" / "Order Online" in relevant sections
- DO NOT use phone-first hero for restaurants
- Appetizing visual treatment, warm colors`,
  default: `
TEMPLATE: You are generating a GENERAL SERVICE business website.
STRUCTURAL REQUIREMENTS:
- Clean professional layout with hero → services → about → testimonials → contact
- Balanced CTAs in hero and repeated throughout`,
};

function detectIndustryTemplate(industry: string): string {
  const lower = industry.toLowerCase();
  if (lower.includes('law') || lower.includes('attorney') || lower.includes('legal')) return 'legal';
  if (lower.includes('doctor') || lower.includes('medical') || lower.includes('health') || lower.includes('clinic')) return 'healthcare';
  if (lower.includes('restaurant') || lower.includes('cafe') || lower.includes('food') || lower.includes('menu')) return 'restaurant';
  if (lower.includes('plumbing') || lower.includes('hvac') || lower.includes('roof') || lower.includes('contractor') || lower.includes('electric')) return 'home-services';
  return 'default';
}

import type { BusinessProfile, FactualSiteData } from './schemas';

export function buildProposeWebsitePlanFromCrawlPrompt(input: {
  factualSiteData: FactualSiteData;
  businessProfile: BusinessProfile;
  crawlSummary?: string;
  revisionInstruction?: string;
}): string {
  const { factualSiteData, businessProfile, crawlSummary, revisionInstruction } = input;

  return `You are a senior website strategist for small businesses. Create a practical website plan to modernize an existing site using ONLY crawled facts as ground truth.

RULES:
- Do not invent fake phone numbers, emails, addresses, testimonials, awards, certifications, years of experience, or guarantees.
- Services/testimonials/contact must come from factualSiteData or businessProfile — never fabricate.
- If contact info is missing from crawl, add it to "requiredMissingInfo" — do NOT fabricate it.
- Include testimonials in contentPlan only when factualSiteData.testimonials has entries.
- Only include services from practiceAreasOrServices or businessProfile.services.
- Populate requiredMissingInfo / riskWarnings when crawl is thin or confidence is low.
- You may improve positioning, section structure, and CTA wording.

BUSINESS PROFILE (derived from crawl):
${JSON.stringify(businessProfile, null, 2)}

FACTUAL SITE DATA (ground truth from crawl — use this as source of truth):
${JSON.stringify(factualSiteData, null, 2)}

${crawlSummary ? `CRAWL SUMMARY:\n${crawlSummary}\n` : ''}
${revisionInstruction ? `REVISION INSTRUCTION:\n${revisionInstruction}\n` : ''}

OUTPUT:
Return ONLY valid JSON matching the website plan schema:
{
  "businessName": string,
  "industry": string,
  "positioning": string,
  "targetCustomers": string[],
  "primaryGoal": string,
  "recommendedPagesOrSections": [{ name, type, priority, purpose }],
  "contentPlan": {
    "hero": { headline, subheadline, primaryCTA, secondaryCTA },
    "sections": [{ type, title, purpose, contentNotes }]
  },
  "requiredMissingInfo": string[],
  "optionalMissingInfo": string[],
  "suggestedTemplate": { category, variant, reason },
  "riskWarnings": string[]
}

Map industry to BOTH category AND variant in suggestedTemplate:
- law/attorney/legal → category: "legal", variant: "premium-professional"
- medical/health/doctor/clinic → category: "healthcare", variant: "healthcare-calm"
- cleaning/plumbing/hvac/roof/electric/contractor → category: "home-services", variant: "local-service-pro"
- restaurant/food/café → category: "restaurant", variant: "restaurant-warm"
- other → category: "general-service", variant: "modern-clean"`;
}

export function buildGenerateSiteSpecPrompt(
  businessProfile: Record<string, unknown>,
  factualSiteData: Record<string, unknown>,
  instruction?: string
): string {
  const industry = String(factualSiteData.industry || businessProfile.industry || '');
  const templateKey = detectIndustryTemplate(industry);
  const templateReqs = TEMPLATE_REQUIREMENTS[templateKey] || TEMPLATE_REQUIREMENTS['default'];

  const factualPhones = Array.isArray(factualSiteData.phoneNumbers) ? (factualSiteData.phoneNumbers as string[]).join(', ') : '';
  const factualEmails = Array.isArray(factualSiteData.emails) ? (factualSiteData.emails as string[]).join(', ') : '';
  const factualPracticeAreas = Array.isArray(factualSiteData.practiceAreasOrServices) ? (factualSiteData.practiceAreasOrServices as string[]).join(', ') : '';
  const factualLocations = Array.isArray(factualSiteData.locations) ? (factualSiteData.locations as any[]).map((l: any) => `${l.label}: ${l.address}`).join('; ') : '';
  const factualServiceAreas = Array.isArray(factualSiteData.serviceAreas) ? (factualSiteData.serviceAreas as string[]).join(', ') : '';
  const factualTestimonials = Array.isArray(factualSiteData.testimonials) ? (factualSiteData.testimonials as any[]).map((t: any) => `"${t.quote}" (from: ${t.sourceText})`).join('; ') : '';
  const profileServices = Array.isArray(businessProfile.services) ? (businessProfile.services as string[]).join(', ') : '';

  return generateSiteSpecPrompt.promptTemplate
    .replace('{factualBusinessName}', String(factualSiteData.businessName || businessProfile.businessName || ''))
    .replace('{factualIndustry}', industry)
    .replace('{factualPracticeAreas}', factualPracticeAreas || profileServices)
    .replace('{factualLocations}', factualLocations || String(businessProfile.location || ''))
    .replace('{factualPhones}', factualPhones || String(businessProfile.phone || ''))
    .replace('{factualEmails}', factualEmails || String(businessProfile.email || ''))
    .replace('{factualServiceAreas}', factualServiceAreas)
    .replace('{factualTestimonials}', factualTestimonials)
    .replace('{description}', String(businessProfile.description || ''))
    .replace('{mainCTA}', String(businessProfile.mainCTA || ''))
    .replace('{brandTone}', String(businessProfile.brandTone || ''))
    .replace('{instruction}', instruction || 'None provided')
    + templateReqs;
}

export function buildApplyEditPrompt(editRequest: string, currentSiteSpec: Record<string, unknown>): string {
  return applyEditPrompt.promptTemplate
    .replace('{editRequest}', editRequest)
    .replace('{currentSiteSpec}', JSON.stringify(currentSiteSpec, null, 2));
}

export const generateDesignBriefPrompt = {
  system: "You are a senior web design director and conversion strategist. Create a premium visual design brief for a generated local business website. The output must be structured JSON matching the schema. Do not write code. Do not output Tailwind classes. Choose a safe design direction that fits the business industry and target customers.",
  promptTemplate: `Create a premium visual design brief for this local business website.

Business Profile:
- Name: {businessName}
- Industry: {industry}
- Description: {description}
- Services: {services}
- Location: {location}
- Phone: {phone}
- Email: {email}
- Brand Tone: {brandTone}
- Target Customers: {targetCustomers}

Site Spec:
- Title: {siteTitle}
- Tagline: {tagline}
- Primary CTA: {primaryCTA}
- Secondary CTA: {secondaryCTA}
- Sections: {sectionTypes}
- Design Direction from spec: {designDirection}

Original Website: {sourceUrl}

Rules:
- For law firms, use premium-professional visualStyle with legal industryTheme.
- For healthcare, use calm-healthcare visualStyle with healthcare industryTheme.
- For home services, use bold-conversion visualStyle with home-services industryTheme.
- For restaurants, use warm-local visualStyle with restaurant industryTheme.
- Make the site feel custom, not generic.
- Prioritize conversion: clear CTA visibility, trust signals, service cards.
- Do not invent awards, certifications, or claims not in the business profile.
- Use trust language only when supported by content.
- Keep all microcopy concise.

Return a valid JSON object matching this schema:
{
  "brandPersonality": string,
  "visualStyle": "premium-professional" | "warm-local" | "modern-minimal" | "bold-conversion" | "calm-healthcare" | "luxury-service",
  "industryTheme": "legal" | "healthcare" | "home-services" | "restaurant" | "beauty" | "real-estate" | "general-service",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex"
  },
  "typography": {
    "headlineStyle": string,
    "bodyStyle": string,
    "fontPairing": "serif-professional" | "sans-modern" | "editorial-premium"
  },
  "layoutStrategy": {
    "heroLayout": "split-hero" | "centered-hero" | "editorial-hero" | "conversion-hero",
    "sectionDensity": "spacious" | "balanced" | "compact",
    "cardStyle": "soft-shadow" | "bordered" | "glass" | "premium-panel",
    "ctaPlacement": "hero-heavy" | "repeated" | "footer-heavy"
  },
  "sectionTreatments": [
    { "sectionType": string, "treatment": string, "notes": string }
  ],
  "conversionStrategy": string[],
  "trustSignals": string[],
  "microcopy": {
    "primaryCtaLabel": string,
    "secondaryCtaLabel": string,
    "contactPrompt": string,
    "footerTagline": string
  },
  "animationStyle": "none" | "subtle" | "premium-subtle"
}`
};

export function buildDesignBriefPrompt(
  businessProfile: Record<string, unknown>,
  siteSpec: Record<string, unknown>,
  sourceUrl: string
): string {
  const sections = siteSpec.sections as Array<{ type: string }> || [];
  return generateDesignBriefPrompt.promptTemplate
    .replace('{businessName}', String(businessProfile.businessName || ''))
    .replace('{industry}', String(businessProfile.industry || ''))
    .replace('{description}', String(businessProfile.description || ''))
    .replace('{services}', Array.isArray(businessProfile.services) ? businessProfile.services.slice(0, 10).join(', ') : '')
    .replace('{location}', String(businessProfile.location || ''))
    .replace('{phone}', String(businessProfile.phone || ''))
    .replace('{email}', String(businessProfile.email || ''))
    .replace('{brandTone}', String(businessProfile.brandTone || ''))
    .replace('{targetCustomers}', Array.isArray(businessProfile.targetCustomers) ? businessProfile.targetCustomers.slice(0, 3).join(', ') : '')
    .replace('{siteTitle}', String(siteSpec.siteTitle || ''))
    .replace('{tagline}', String(siteSpec.tagline || ''))
    .replace('{primaryCTA}', String(siteSpec.primaryCTA || ''))
    .replace('{secondaryCTA}', String(siteSpec.secondaryCTA || ''))
    .replace('{sectionTypes}', sections.map(s => s.type).join(', '))
    .replace('{designDirection}', siteSpec.designDirection ? JSON.stringify(siteSpec.designDirection) : '')
    .replace('{sourceUrl}', sourceUrl);
}