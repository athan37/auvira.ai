import mongoose from 'mongoose';
import { BusinessProfile, type IBusinessProfile } from '@/models/BusinessProfile';
import { WebsiteProject } from '@/models/WebsiteProject';
import { readSiteConfigFromWorkspace } from './siteConfigParser';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';

export interface BusinessProfileInput {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  mainServices?: string[];
  serviceAreas?: string[];
  pricingNotes?: string;
  bannerRules?: Array<{ text: string; expiresAt: string }>;
}

export async function getBusinessProfile(projectId: string): Promise<IBusinessProfile | null> {
  return BusinessProfile.findOne({ projectId: new mongoose.Types.ObjectId(projectId) });
}

export async function seedBusinessProfileFromProject(
  projectId: string,
  ownerId: string
): Promise<IBusinessProfile> {
  const existing = await getBusinessProfile(projectId);
  if (existing) return existing;

  const project = await WebsiteProject.findById(projectId);
  if (!project) throw new Error('Project not found');

  const bp = (project.businessProfile ?? {}) as Record<string, unknown>;
  const siteSpec = project.siteSpec as { siteTitle?: string; sections?: Array<{ type: string; items?: string[] }> };

  let phone = typeof bp.phone === 'string' ? bp.phone : undefined;
  let email = typeof bp.email === 'string' ? bp.email : undefined;
  let address =
    typeof bp.address === 'string' ? bp.address : typeof bp.location === 'string' ? bp.location : undefined;
  let mainServices: string[] = Array.isArray(bp.services) ? (bp.services as string[]).slice(0, 3) : [];

  try {
    const { config } = await readSiteConfigFromWorkspace(getGitWorkspacePath(projectId));
    if (config) {
      phone = config.contact?.phone ?? phone;
      email = config.contact?.email ?? email;
      address = config.contact?.address ?? address;
      if (!mainServices.length && config.sections) {
        const sec = config.sections.find((s) => s.type === 'services');
        mainServices = (sec?.items ?? []).map((i) => i.title ?? '').filter(Boolean).slice(0, 3);
      }
    }
  } catch {
    /* workspace optional */
  }

  const contactSection = siteSpec.sections?.find((s) => s.type === 'contact');
  const hoursItem = contactSection?.items?.find(
    (i) => typeof i === 'string' && i.toLowerCase().includes('hour')
  );

  return BusinessProfile.create({
    projectId: new mongoose.Types.ObjectId(projectId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    businessName:
      (typeof bp.businessName === 'string' ? bp.businessName : undefined) ||
      siteSpec.siteTitle ||
      project.name,
    phone,
    email,
    address,
    hours: typeof hoursItem === 'string' ? hoursItem : undefined,
    mainServices,
    bannerRules: [],
  });
}

export async function upsertBusinessProfile(
  projectId: string,
  ownerId: string,
  input: BusinessProfileInput
): Promise<IBusinessProfile> {
  let profile = await getBusinessProfile(projectId);
  if (!profile) profile = await seedBusinessProfileFromProject(projectId, ownerId);

  if (input.businessName !== undefined) profile.businessName = input.businessName;
  if (input.phone !== undefined) profile.phone = input.phone;
  if (input.email !== undefined) profile.email = input.email;
  if (input.address !== undefined) profile.address = input.address;
  if (input.hours !== undefined) profile.hours = input.hours;
  if (input.mainServices !== undefined) profile.mainServices = input.mainServices;
  if (input.serviceAreas !== undefined) profile.serviceAreas = input.serviceAreas;
  if (input.pricingNotes !== undefined) profile.pricingNotes = input.pricingNotes;
  if (input.bannerRules !== undefined) profile.bannerRules = input.bannerRules;

  await profile.save();
  return profile;
}

export async function confirmBusinessProfile(projectId: string, ownerId: string): Promise<IBusinessProfile> {
  const profile = await getBusinessProfile(projectId);
  if (!profile) throw new Error('Business profile not found');
  profile.confirmedAt = new Date();
  await profile.save();
  return profile;
}
