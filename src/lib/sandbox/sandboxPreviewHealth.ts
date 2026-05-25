import { PAGE_TSX_TEMPLATE } from '@/lib/builder/pageTemplate';
import {
  checkPreviewUrlHealthy,
  waitForPreviewReady,
} from '@/lib/preview/waitForPreviewReady';
import { describeUnhealthyPreviewUrl } from '@/lib/preview/extractPreviewCompileError';
import { repairPageTsxStructure } from '@/lib/project-workspace/repairPageTsxStructure';
import { checkTsxSyntax } from '@/lib/project-workspace/validateTsxSyntax';
import { getSandboxGateway } from './sandboxWorkspaceGateway';

const PAGE_REL = 'src/app/page.tsx';

/** Extract `const preset = { ... };` object literal from page.tsx. */
export function extractPresetJsonFromPage(page: string): string | null {
  const startMarker = 'const preset = ';
  const idx = page.indexOf(startMarker);
  if (idx < 0) return null;
  const jsonStart = idx + startMarker.length;
  if (page[jsonStart] !== '{') return null;

  let depth = 0;
  for (let i = jsonStart; i < page.length; i++) {
    const ch = page[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return page.slice(jsonStart, i + 1);
      }
    }
  }
  return null;
}

/** Rebuild page.tsx from the canonical template, preserving theme preset. */
export function rebuildPageFromTemplate(presetJson: string): string {
  return PAGE_TSX_TEMPLATE.replace('__PRESET_JSON__', presetJson);
}

export type SandboxPageSyntaxRepairResult = {
  repaired: boolean;
  notes: string[];
};

/**
 * Repair broken page.tsx in the sandbox: dedupe components, then rebuild from template if needed.
 */
export async function repairSandboxPageSyntax(
  projectId: string
): Promise<SandboxPageSyntaxRepairResult> {
  const gateway = await getSandboxGateway(projectId);
  let page: string | null = null;
  try {
    page = await gateway.readFile(PAGE_REL);
  } catch {
    return { repaired: false, notes: [] };
  }
  if (!page) return { repaired: false, notes: [] };

  const notes: string[] = [];
  const structural = repairPageTsxStructure(page);
  if (structural.repaired) {
    page = structural.content;
    notes.push(...structural.notes);
    await gateway.writeFile(PAGE_REL, page);
  }

  if (checkTsxSyntax(page, PAGE_REL).length === 0) {
    return { repaired: notes.length > 0, notes };
  }

  const presetJson = extractPresetJsonFromPage(page);
  if (presetJson) {
    const rebuilt = rebuildPageFromTemplate(presetJson);
    if (checkTsxSyntax(rebuilt, PAGE_REL).length === 0) {
      await gateway.writeFile(PAGE_REL, rebuilt);
      notes.push('rebuilt page.tsx from canonical template (preset preserved)');
      return { repaired: true, notes };
    }
  }

  return { repaired: false, notes };
}

/** Fail fast when page.tsx cannot compile (after repair attempts). */
export async function assertSandboxPageSyntax(projectId: string): Promise<void> {
  const repair = await repairSandboxPageSyntax(projectId);
  if (repair.repaired) return;

  const gateway = await getSandboxGateway(projectId);
  let page: string | null = null;
  try {
    page = await gateway.readFile(PAGE_REL);
  } catch {
    return;
  }
  if (!page) return;

  const errors = checkTsxSyntax(page, PAGE_REL);
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
