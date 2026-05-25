/**
 * Owner website edit orchestrator.
 * Default: TypeScript WebsiteEditAgent (router + single-shot + tool loop).
 */

import { promises as fs } from 'fs';
import { runWebsiteEditAgent } from './website-edit-agent';
import type { AgentStepEvent } from './website-edit-agent/types';
import { isAllowedWorkspacePath } from './workspaceEditShared';

export type WebsiteEditAgentMode = 'ts';

export interface WebsiteEditResult {
  ok: boolean;
  summary?: string;
  ownerMessage?: string;
  rawOutput?: string;
  error?: string;
  changedFiles?: string[];
  agent?: WebsiteEditAgentMode;
  strategy?: string;
}

import type { WorkspaceGateway } from './workspaceGateway';

export interface WebsiteEditOptions {
  workspacePath: string;
  ownerMessage: string;
  projectId: string;
  mode: 'gitlab' | 'static';
  attachments?: import('./workspaceAssetTypes').WorkspaceAssetAttachment[];
  gateway?: WorkspaceGateway;
}

export { routeEditRequest, isTrivialStyleEdit } from './website-edit-agent/intentRouter';

/**
 * Run the configured website edit agent for an owner request.
 */
export async function runWebsiteEdit(
  options: WebsiteEditOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditResult> {
  if (!options.gateway && !isAllowedWorkspacePath(options.workspacePath)) {
    return { ok: false, error: 'Workspace path is not in an allowed directory.' };
  }

  if (!options.gateway) {
    try {
      const stat = await fs.stat(options.workspacePath);
      if (!stat.isDirectory()) {
        return { ok: false, error: 'Workspace path is not a directory.' };
      }
    } catch {
      return { ok: false, error: 'Workspace does not exist.' };
    }
  }

  const result = await runWebsiteEditAgent(
    {
      workspacePath: options.workspacePath,
      ownerMessage: options.ownerMessage,
      projectId: options.projectId,
      mode: options.mode,
      attachments: options.attachments,
      gateway: options.gateway,
    },
    onStep
  );

  return {
    ok: result.ok,
    summary: result.summary || result.ownerMessage,
    ownerMessage: result.ownerMessage,
    error: result.error,
    changedFiles: result.changedFiles,
    agent: 'ts',
    strategy: result.strategy,
  };
}
