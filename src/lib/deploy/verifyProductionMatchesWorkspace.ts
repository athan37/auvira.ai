import { promises as fs } from 'fs';
import path from 'path';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';

const MARKER_FILES = ['src/lib/siteConfig.ts', 'src/app/page.tsx'] as const;

function extractMarker(content: string): string | null {
  const headline = content.match(/headline:\s*['"]([^'"]+)['"]/);
  if (headline?.[1]) return headline[1];

  const businessName = content.match(/businessName:\s*['"]([^'"]+)['"]/);
  if (businessName?.[1]) return businessName[1];

  const green = content.match(/green-500/);
  if (green) return 'green-500';

  return null;
}

async function readLocalMarker(projectId: string): Promise<string | null> {
  const workspacePath = getGitWorkspacePath(projectId);

  for (const rel of MARKER_FILES) {
    try {
      const content = await fs.readFile(path.join(workspacePath, rel), 'utf-8');
      const marker = extractMarker(content);
      if (marker) return marker;
    } catch {
      /* try next file */
    }
  }

  return null;
}

async function readGitLabMarker(
  gitlabProjectId: number,
  commitSha: string,
  filePath: string
): Promise<string | null> {
  const token = process.env.GITLAB_TOKEN;
  const baseUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com/api/v4';
  if (!token) return null;

  const url = `${baseUrl}/projects/${gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(commitSha)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const content = await res.text();
    return extractMarker(content);
  } catch {
    return null;
  }
}

/**
 * After Vercel is ready, verify production HTML includes a marker from the deployed workspace.
 */
export async function verifyProductionMatchesWorkspace(input: {
  productionUrl: string;
  projectId: string;
  gitlabProjectId?: number;
  commitSha?: string;
}): Promise<{ ok: boolean; message: string }> {
  const marker = await readLocalMarker(input.projectId);
  if (!marker) {
    return { ok: true, message: 'No content marker available to verify.' };
  }

  if (input.gitlabProjectId && input.commitSha) {
    for (const filePath of MARKER_FILES) {
      const gitlabMarker = await readGitLabMarker(
        input.gitlabProjectId,
        input.commitSha,
        filePath
      );
      if (gitlabMarker && gitlabMarker !== marker) {
        return {
          ok: false,
          message: 'GitLab commit content does not match local preview.',
        };
      }
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(input.productionUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        message: `Production URL returned HTTP ${res.status}.`,
      };
    }

    const html = await res.text();
    if (html.includes(marker)) {
      return { ok: true, message: 'Production content matches preview.' };
    }

    return {
      ok: false,
      message:
        'Deploy finished but production content may be stale. Hard-refresh the live site or wait a minute.',
    };
  } catch {
    return {
      ok: false,
      message: 'Could not reach production URL to verify content.',
    };
  }
}
