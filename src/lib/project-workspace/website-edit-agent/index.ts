import { promises as fs } from 'fs';
import path from 'path';
import { isAllowedWorkspacePath } from '../workspaceEditShared';
import { routeEditRequest } from './intentRouter';
import { enrichEditPrompt } from './enrichEditPrompt';
import { runSingleShotStrategy } from './singleShotStrategy';
import { runSectionConfigStrategy } from './sectionConfigStrategy';
import { runImageGallerySectionStrategy } from './imageGallerySectionStrategy';
import { runAgentLoop } from './WebsiteEditAgent';
import type {
  AgentStepEvent,
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
} from './types';
import { computeWorkspaceHashes } from '../workspaceEditShared';
import { verifyEditApplied } from './verifyEditApplied';

const STYLE_VERIFY_PATHS = ['src/app/page.tsx', 'src/app/globals.css'] as const;

async function readWorkspaceRel(
  options: WebsiteEditAgentOptions,
  rel: string
): Promise<string | null> {
  try {
    if (options.gateway) {
      return await options.gateway.readFile(rel);
    }
    return await fs.readFile(path.join(options.workspacePath, rel), 'utf-8');
  } catch {
    return null;
  }
}

async function snapshotStyleTargets(
  options: WebsiteEditAgentOptions
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const rel of STYLE_VERIFY_PATHS) {
    const content = await readWorkspaceRel(options, rel);
    if (content !== null) {
      files[rel] = content;
    }
  }
  return files;
}

async function captureChangedFileContents(
  options: WebsiteEditAgentOptions,
  changedFiles: string[]
): Promise<Record<string, string>> {
  const captured: Record<string, string> = {};
  for (const rel of changedFiles) {
    const content = await readWorkspaceRel(options, rel);
    if (content !== null) {
      captured[rel] = content;
    }
  }
  return captured;
}

export { routeEditRequest, isTrivialStyleEdit } from './intentRouter';
export { verifyEditApplied, summarizeActualChanges } from './verifyEditApplied';
export type { WebsiteEditAgentOptions, WebsiteEditAgentResult, AgentStepEvent };

/**
 * Main entry: route request → single-shot or agent loop.
 */
export async function runWebsiteEditAgent(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  if (!options.gateway && !isAllowedWorkspacePath(options.workspacePath)) {
    return { ok: false, error: 'Workspace path is not in an allowed directory.' };
  }

  const decision = routeEditRequest(options.ownerMessage);
  const beforeHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const hasAttachments = (options.attachments?.length ?? 0) > 0;

  if (!hasAttachments && decision.strategy === 'single_shot') {
    const beforeFiles = await snapshotStyleTargets(options);
    const fast = await runSingleShotStrategy(options, beforeHashes);
    if (fast?.ok && fast.changedFiles?.length) {
      const capturedAfter = await captureChangedFileContents(options, fast.changedFiles);
      const verification = verifyEditApplied(options.ownerMessage, beforeFiles, {
        ...beforeFiles,
        ...capturedAfter,
      });
      if (verification.ok) {
        return fast;
      }
      return {
        ok: false,
        strategy: 'single_shot',
        error: verification.reason,
        ownerMessage: "I couldn't safely apply that change. Please try rephrasing your request.",
      };
    }
    if (fast?.ok) {
      return fast;
    }
  }

  if (decision.intent === 'section' && options.mode === 'gitlab') {
    if (hasAttachments) {
      const beforeFiles: Record<string, string> = {};
      for (const rel of ['src/lib/siteConfig.ts', 'src/app/page.tsx']) {
        const content = await readWorkspaceRel(options, rel);
        if (content) beforeFiles[rel] = content;
      }
      const gallery = await runImageGallerySectionStrategy(options, beforeHashes);
      if (gallery?.ok) {
        return gallery;
      }
      if (gallery && !gallery.ok) {
        return gallery;
      }
      const fast = await runSingleShotStrategy(options, beforeHashes);
      if (fast?.ok && fast.changedFiles?.length) {
        const capturedAfter = await captureChangedFileContents(options, fast.changedFiles);
        const verification = verifyEditApplied(options.ownerMessage, beforeFiles, {
          ...beforeFiles,
          ...capturedAfter,
        });
        if (verification.ok) {
          return fast;
        }
        return {
          ok: false,
          strategy: 'single_shot',
          error: verification.reason,
          ownerMessage: "I couldn't safely apply that change. Please try rephrasing your request.",
        };
      }
      if (fast?.ok) {
        return fast;
      }
    } else {
      const sectionFast = await runSectionConfigStrategy(options, beforeHashes);
      if (sectionFast?.ok) {
        return sectionFast;
      }
    }
  }

  const enriched = await enrichEditPrompt(
    options.workspacePath,
    options.mode,
    options.ownerMessage,
    decision.intent,
    options.attachments || [],
    options.gateway
  );

  return runAgentLoop(
    {
      ...options,
      agentPrompt: enriched.agentPrompt,
    },
    onStep
  );
}
