import mongoose from 'mongoose';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { WebsiteAnalyticsConfig } from '@/models/WebsiteAnalyticsConfig';
import { createPublicAnalyticsSiteKey } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';

export interface EnsureWebsiteAnalyticsConfigInput {
  project: IWebsiteProject;
  publicSiteKey?: string;
  allowedOrigins?: string[];
}

function normalizeOrigins(origins: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (origins ?? [])
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => {
          try {
            return new URL(origin).origin;
          } catch {
            return origin.replace(/\/+$/, '');
          }
        })
    )
  );
}

export function deploymentOrigins(project: IWebsiteProject): string[] {
  return normalizeOrigins(
    [
      project.deployment?.liveUrl ?? '',
      project.deployment?.expectedProductionUrl ?? '',
      project.deployment?.deploymentUrl ?? '',
    ].filter(Boolean)
  );
}

export async function ensureWebsiteAnalyticsConfig(
  input: EnsureWebsiteAnalyticsConfigInput
) {
  const existing = await WebsiteAnalyticsConfig.findOne({ projectId: input.project._id });
  if (existing) {
    const allowedOrigins = normalizeOrigins([
      ...existing.allowedOrigins,
      ...(input.allowedOrigins ?? []),
    ]);
    if (allowedOrigins.length !== existing.allowedOrigins.length) {
      existing.allowedOrigins = allowedOrigins;
      await existing.save();
    }
    return existing;
  }

  return WebsiteAnalyticsConfig.create({
    projectId: input.project._id,
    ownerId: input.project.ownerId,
    publicSiteKey: input.publicSiteKey || createPublicAnalyticsSiteKey(),
    enabled: true,
    allowedOrigins: normalizeOrigins(input.allowedOrigins),
  });
}

export async function createWebsiteAnalyticsConfigForProject(input: {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  publicSiteKey?: string;
  allowedOrigins?: string[];
}) {
  return WebsiteAnalyticsConfig.findOneAndUpdate(
    { projectId: input.projectId },
    {
      $setOnInsert: {
        projectId: input.projectId,
        ownerId: input.ownerId,
        publicSiteKey: input.publicSiteKey || createPublicAnalyticsSiteKey(),
        enabled: true,
      },
      $set: {
        allowedOrigins: normalizeOrigins(input.allowedOrigins),
      },
    },
    { upsert: true, new: true }
  );
}
