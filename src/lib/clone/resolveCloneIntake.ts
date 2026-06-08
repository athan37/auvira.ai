import type { BusinessProfile, FactualSiteData, ScratchIntake } from '@/lib/agent/schemas';

/** Map crawl-derived facts into scratch build intake for `buildWebsiteFromPlan`. */
export function resolveCloneIntake(
  factualSiteData: FactualSiteData,
  businessProfile: BusinessProfile
): ScratchIntake {
  const services =
    factualSiteData.practiceAreasOrServices?.length > 0
      ? factualSiteData.practiceAreasOrServices
      : businessProfile.services ?? [];

  const location =
    factualSiteData.locations?.[0]?.address ||
    factualSiteData.serviceAreas?.slice(0, 3).join(', ') ||
    businessProfile.location ||
    '';

  const testimonialCount = factualSiteData.testimonials?.length ?? 0;
  const missingFields = factualSiteData.missingCriticalFields ?? [];
  const notesParts: string[] = [];
  if (testimonialCount > 0) {
    notesParts.push(`${testimonialCount} testimonial(s) extracted from source site`);
  }
  if (missingFields.length > 0) {
    notesParts.push(`Crawl gaps: ${missingFields.join(', ')}`);
  }
  if (factualSiteData.confidence?.overall !== undefined && factualSiteData.confidence.overall < 0.6) {
    notesParts.push('Low crawl confidence — verify facts before deploy');
  }

  return {
    businessName: factualSiteData.businessName || businessProfile.businessName || '',
    industry: factualSiteData.industry || businessProfile.industry || '',
    location,
    services: services.join(', '),
    targetCustomers: businessProfile.targetCustomers?.join(', ') || '',
    mainGoal: businessProfile.mainCTA || businessProfile.description || 'Generate leads',
    phone: factualSiteData.phoneNumbers?.[0] || businessProfile.phone || '',
    email: factualSiteData.emails?.[0] || businessProfile.email || '',
    address: factualSiteData.locations?.[0]?.address || '',
    desiredStyle: businessProfile.brandTone || 'professional',
    notes: notesParts.join('. '),
  };
}
