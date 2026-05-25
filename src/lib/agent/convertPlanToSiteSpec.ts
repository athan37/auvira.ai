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
  const cta = goalToCTA(websitePlan.primaryGoal);
  const rawTemplate = websitePlan.suggestedTemplate?.category
    ? { category: websitePlan.suggestedTemplate.category, variant: websitePlan.suggestedTemplate.variant }
    : industryToTemplate(websitePlan.industry);
  const template = normalizeTemplateSelection(rawTemplate.category, rawTemplate.variant);

  const sections: SiteSection[] = [];

  // Build hero section from contentPlan
  sections.push({
    type: 'hero',
    title: '',
    body: '',
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

    // Check if contact section already exists
    const hasContactSection = sections.some(s => s.type === 'contact');
    if (!hasContactSection) {
      sections.push({
        type: 'contact',
        title: 'Contact Us',
        body: `Get in touch with ${websitePlan.businessName}. We serve ${intake.location || 'your area'}.`,
        items: contactItems,
      });
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
    siteTitle: websitePlan.businessName,
    tagline: websitePlan.positioning?.split('.')[0] || `${websitePlan.businessName} — ${websitePlan.industry}`,
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