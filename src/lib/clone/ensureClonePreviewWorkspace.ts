import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SiteSpec } from '@/lib/agent/schemas';
import type { ICloneJob } from '@/lib/db/models/CloneJob';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateCloneWebsiteFiles } from '@/lib/clone/cloneTemplateSelection';
import { readWorkspaceFiles, type WorkspaceFile } from '@/lib/clone/persistClonePreview';
import { scratchPath } from '@/lib/runtime/scratchDir';

function writeFilesToDisk(files: WorkspaceFile[], workspacePath: string): void {
  for (const file of files) {
    const filePath = join(workspacePath, file.filePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, file.content, 'utf-8');
  }
}

function industryFromProfile(bp: Record<string, unknown> | undefined): string {
  const industry = String(bp?.industry || '').toLowerCase();
  if (industry.includes('legal')) return 'legal';
  if (industry.includes('health')) return 'healthcare';
  if (industry.includes('restaurant')) return 'restaurant';
  if (industry.includes('plumb') || industry.includes('hvac')) return 'home-services';
  return 'general-service';
}

/** Regenerate site files from the job's saved preview spec (includes chat edits). */
export async function regenerateClonePreviewFilesAsync(job: ICloneJob): Promise<WorkspaceFile[]> {
  const siteSpec = (job.previewSiteSpec || job.proposedWebsitePlan) as SiteSpec | undefined;
  if (!siteSpec || typeof siteSpec !== 'object') {
    throw new Error('No preview site spec saved. Please rebuild preview from the review step.');
  }

  const bp = job.businessProfile as Record<string, unknown> | undefined;
  const businessName = String(bp?.businessName || job.projectName || 'generated-site');

  let designBrief;
  try {
    designBrief = await generateDesignBriefAgent(
      bp || {},
      siteSpec as unknown as Record<string, unknown>,
      job.sourceUrl
    );
  } catch {
    designBrief = getDefaultDesignBrief(industryFromProfile(bp));
  }

  const generated = generateCloneWebsiteFiles(
    siteSpec,
    businessName,
    designBrief,
    job.suggestedTemplate
  );
  return generated.files.map((f) => ({ filePath: f.filePath, content: f.content }));
}

function workspaceHasFiles(workspacePath: string): boolean {
  if (!existsSync(workspacePath)) return false;
  return readWorkspaceFiles(workspacePath).length > 0;
}

/**
 * Ensures clone preview files exist on disk. Rehydrates from previewSiteSpec when missing
 * (Vercel /tmp recycle, TTL prune, or local restart).
 */
export async function ensureClonePreviewWorkspace(job: ICloneJob): Promise<string> {
  const jobId = job._id.toString();
  const workspacePath =
    job.technicalBuild?.workspacePath || scratchPath('generated-sites', jobId);

  if (workspaceHasFiles(workspacePath)) {
    return workspacePath;
  }

  const files = await regenerateClonePreviewFilesAsync(job);
  if (files.length === 0) {
    throw new Error('Could not restore preview files. Please rebuild preview.');
  }

  if (existsSync(workspacePath)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }
  mkdirSync(workspacePath, { recursive: true });
  writeFilesToDisk(files, workspacePath);

  await CloneJob.updateOne(
    { _id: job._id },
    {
      $set: {
        'technicalBuild.workspacePath': workspacePath,
        'technicalBuild.files': files.map((f) => ({ path: f.filePath, status: 'done' as const })),
        'technicalBuild.rehydratedAt': new Date(),
      },
    }
  );

  console.log(`[clone-preview] rehydrated workspace job=${jobId} path=${workspacePath} files=${files.length}`);

  return workspacePath;
}
