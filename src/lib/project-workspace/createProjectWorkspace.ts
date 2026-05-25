/**
 * Creates a per-project workspace with standalone HTML/CSS files.
 * Used by the owner-facing project website coding agent.
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { generatePageHtml } from '@/lib/preview/generatePageHtml';
import { generatePreviewCss } from '@/lib/preview/generatePreviewCss';
import { scratchPath } from '@/lib/runtime/scratchDir';

export async function createProjectWorkspace(project: IWebsiteProject): Promise<{
  workspacePath: string;
  version: string;
}> {
  const projectId = project._id.toString();
  const workspaceDir = scratchPath('project-workspaces', projectId);

  // Ensure workspace directory exists
  await fs.mkdir(workspaceDir, { recursive: true });

  // Use draftSiteSpec or siteSpec
  const spec = project.draftSiteSpec || project.siteSpec;

  // Generate preview version from spec content
  const previewVersion = computePreviewVersion(spec);

  // Generate HTML and CSS
  const html = generatePageHtml(spec as any, project.name, previewVersion);
  // Replace the {{projectId}} placeholder with actual projectId
  const htmlWithProjectId = html.replace('{{projectId}}', projectId);
  const css = generatePreviewCss(spec);

  // Write files
  await fs.writeFile(path.join(workspaceDir, 'index.html'), htmlWithProjectId, 'utf-8');
  await fs.writeFile(path.join(workspaceDir, 'styles.css'), css, 'utf-8');
  await fs.writeFile(path.join(workspaceDir, 'site.json'), JSON.stringify(spec, null, 2), 'utf-8');
  await fs.writeFile(path.join(workspaceDir, 'metadata.json'), JSON.stringify({
    projectId,
    projectName: project.name,
    createdAt: new Date().toISOString(),
    previewVersion,
  }, null, 2), 'utf-8');

  // Create assets directory
  await fs.mkdir(path.join(workspaceDir, 'assets'), { recursive: true });

  return {
    workspacePath: workspaceDir,
    version: previewVersion,
  };
}

export async function readWorkspaceFile(projectId: string, filename: string): Promise<string | null> {
  const filePath = scratchPath('project-workspaces', projectId, filename);
  // Safety: ensure file is within workspace
  const workspaceDir = scratchPath('project-workspaces', projectId);
  if (!filePath.startsWith(workspaceDir)) {
    return null;
  }
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeWorkspaceFile(projectId: string, filename: string, content: string): Promise<boolean> {
  const filePath = scratchPath('project-workspaces', projectId, filename);
  const workspaceDir = scratchPath('project-workspaces', projectId);
  if (!filePath.startsWith(workspaceDir)) {
    return false;
  }
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export async function createWorkspaceSnapshot(projectId: string): Promise<string | null> {
  const workspaceDir = scratchPath('project-workspaces', projectId);
  const snapshotDir = scratchPath('project-workspaces', projectId, 'snapshots', Date.now().toString());
  try {
    await fs.mkdir(path.join(workspaceDir, 'snapshots'), { recursive: true });
    // Simple copy: read all files and write to snapshot
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    await fs.mkdir(snapshotDir, { recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const src = path.join(workspaceDir, entry.name);
        const dst = path.join(snapshotDir, entry.name);
        await fs.copyFile(src, dst);
      } else if (entry.isDirectory() && entry.name !== 'snapshots') {
        await fs.mkdir(path.join(snapshotDir, entry.name), { recursive: true });
        const subEntries = await fs.readdir(path.join(workspaceDir, entry.name), { withFileTypes: true });
        for (const subEntry of subEntries) {
          if (subEntry.isFile()) {
            await fs.copyFile(
              path.join(workspaceDir, entry.name, subEntry.name),
              path.join(snapshotDir, entry.name, subEntry.name)
            );
          }
        }
      }
    }
    return snapshotDir;
  } catch {
    return null;
  }
}

export async function restoreFromSnapshot(projectId: string, snapshotPath: string): Promise<boolean> {
  const workspaceDir = scratchPath('project-workspaces', projectId);
  const snapDir = path.resolve(snapshotPath);
  if (!snapDir.startsWith(scratchPath('project-workspaces', projectId, 'snapshots'))) {
    return false;
  }
  try {
    // Copy all files from snapshot back to workspace
    const entries = await fs.readdir(snapDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        await fs.copyFile(path.join(snapDir, entry.name), path.join(workspaceDir, entry.name));
      } else if (entry.isDirectory()) {
        await fs.mkdir(path.join(workspaceDir, entry.name), { recursive: true });
        const subEntries = await fs.readdir(path.join(snapDir, entry.name), { withFileTypes: true });
        for (const subEntry of subEntries) {
          if (subEntry.isFile()) {
            await fs.copyFile(
              path.join(snapDir, entry.name, subEntry.name),
              path.join(workspaceDir, entry.name, subEntry.name)
            );
          }
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

function computePreviewVersion(spec: any): string {
  const str = JSON.stringify(spec);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}