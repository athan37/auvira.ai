import {
  checkPreviewUrlHealthy,
  waitForPreviewReady,
} from '@/lib/preview/waitForPreviewReady';
import { describeUnhealthyPreviewUrl } from '@/lib/preview/extractPreviewCompileError';
import { checkTsxSyntax } from '@/lib/project-workspace/validateTsxSyntax';
import { getSandboxGateway } from './sandboxWorkspaceGateway';

/** Fail fast when page.tsx cannot compile (avoids 2+ minute health poll on HTTP 500). */
export async function assertSandboxPageSyntax(projectId: string): Promise<void> {
  const gateway = await getSandboxGateway(projectId);
  let page: string | null = null;
  try {
    page = await gateway.readFile('src/app/page.tsx');
  } catch {
    return;
  }
  if (!page) return;

  const errors = checkTsxSyntax(page, 'src/app/page.tsx');
  if (errors.length === 0) return;

  const summary = errors.slice(0, 3).join('; ');
  throw new Error(
    `src/app/page.tsx has syntax errors (${errors.length}): ${summary}. Fix in GitLab or use the site editor, then reopen the project.`
  );
}

export async function waitForSandboxPreview(previewUrl: string): Promise<void> {
  try {
    await waitForPreviewReady(previewUrl, { timeoutMs: 120_000, intervalMs: 1500 });
  } catch {
    const healthy = await checkPreviewUrlHealthy(previewUrl, 15_000);
    if (!healthy) {
      const base = `Sandbox preview at ${previewUrl} did not become healthy`;
      throw new Error(await describeUnhealthyPreviewUrl(previewUrl, base));
    }
  }
}
