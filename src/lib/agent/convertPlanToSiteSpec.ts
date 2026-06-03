import type { WebsitePlan, SiteSpec, SiteSection, ScratchIntake } from './schemas';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';

function goalToCTA(mainGoal: string): { primary: string; secondary: string } {
  const goal = mainGoal.toLowerCase();
  if (goal.includes('lead')) return { primary: 'Get a Free Quote', secondary: 'View Services' };
  if (goal.includes('appoint')) return { primary: 'Book Appointment', secondary: 'Learn More' };
  if (goal.includes('sell')) return { primary: 'Shop Now', secondary: 'View Products' };
  if (goal.includes('menu')) return { primary: 'View Menu', secondary: 'Order Online' };
  if (goal.includes('credib')) return { primary: 'Learn About Us', secondary: 'Our Services' };
  if (goal.includes('portfolio')) return { primary: 'View Portfolio', secondary: 'Contact Us' };
  return { primary: 'Get Started', secondary: 'Learn More' };
}

function industryToTemplate(industry: string): { category: string; variant: string } {
  const lower = industry.toLowerCase();
  if (lower.includes('law') || lower.includes('attorney') || lower.includes('legal')) {
    return { category: 'legal', variant: 'premium-professional' };
  }
  if (lower.includes('medical') || lower.includes('health') || lower.includes('doctor') || lower.includes('clinic')) {
    return { category: 'healthcare', variant: 'healthcare-calm' };
  }
  if (lower.includes('clean') || lower.includes('plumb') || lower.includes('hvac') || lower.includes('roof') || lower.includes('electric') || lower.includes('contractor')) {
    return { category: 'home-services', variant: 'local-service-pro' };
  }
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('café') || lower.includes('cafe')) {
    return { category: 'restaurant', variant: 'restaurant-warm' };
  }
  return { category: 'general-service', variant: 'modern-clean' };
}

export function convertPlanToSiteSpec(
  websitePlan: WebsitePlan,
  intake: ScratchIntake
): SiteSpec {
  const planHero = websitePlan.contentPlan?.hero;
  const cta = planHero?.primaryCTA && planHero?.secondaryCTA
    ? { primary: planHero.primaryCTA, secondary: planHero.secondaryCTA }
    : goalToCTA(websitePlan.primaryGoal);
  const rawTemplate = websitePlan.suggestedTemplate?.category
    ? { category: websitePlan.suggestedTemplate.category, variant: websitePlan.suggestedTemplate.variant }
    : industryToTemplate(websitePlan.industry);
  const template = normalizeTemplateSelection(rawTemplate.category, rawTemplate.variant);

  const sections: SiteSection[] = [];

  const heroHeadline = planHero?.headline?.trim() || '';
  const heroSubheadline = planHero?.subheadline?.trim() || '';

  sections.push({
    type: 'hero',
    title: heroHeadline,
    body: heroSubheadline,
    items: [],
  });

  // Build sections from contentPlan
  if (websitePlan.contentPlan?.sections) {
    for (const sec of websitePlan.contentPlan.sections) {
      sections.push({
        type: sec.type as SiteSection['type'],
        title: sec.title,
        body: sec.purpose || '',
        items: sec.contentNotes || [],
      });
    }
  }

  // Add contact section if user provided contact info
  const hasContact = (intake.phone || intake.email || intake.address);
  if (hasContact) {
    const contactItems: string[] = [];
    if (intake.phone) contactItems.push(intake.phone);
    if (intake.email) contactItems.push(intake.email);
    if (intake.address) contactItems.push(intake.address);

    const contactSection = sections.find((s) => s.type === 'contact');
    if (!contactSection) {
      sections.push({
        type: 'contact',
        title: 'Contact Us',
        body: `Get in touch with ${websitePlan.businessName}. We serve ${intake.location || 'your area'}.`,
        items: contactItems,
      });
    } else {
      const existing = (contactSection.items as string[]) || [];
      const merged = [...existing];
      for (const item of contactItems) {
        const normalized = item.trim().toLowerCase();
        const alreadyListed = merged.some(
          (entry) =>
            entry.trim().toLowerCase() === normalized ||
            entry.includes(item) ||
            item.includes(entry)
        );
        if (!alreadyListed) merged.push(item);
      }
      contactSection.items = merged;
    }
  }

  // Add services from user intake if provided and no services section exists
  if (intake.services) {
    const hasServices = sections.some(s => s.type === 'services');
    if (!hasServices) {
      const serviceItems = intake.services.split(',').map(s => s.trim()).filter(Boolean);
      sections.push({
        type: 'services',
        title: 'Our Services',
        body: `Professional services in ${intake.location || 'your area'}.`,
        items: serviceItems,
      });
    }
  }

  // Ensure we have at least 4 sections
  if (sections.length < 4) {
    sections.push({
      type: 'about',
      title: 'About Us',
      body: websitePlan.positioning || `We are ${websitePlan.businessName}, serving ${intake.location || 'your area'}.`,
      items: [],
    });
  }

  return {
    siteTitle: heroHeadline || websitePlan.businessName,
    tagline:
      heroSubheadline ||
      websitePlan.positioning?.split('.')[0] ||
      `${websitePlan.businessName} — ${websitePlan.industry}`,
    primaryCTA: cta.primary,
    secondaryCTA: cta.secondary,
    sections,
    designDirection: {
      tone: intake.desiredStyle || 'professional',
      layout: template.category,
      colors: [],
    },
  };
}