/**
 * Owner website edit orchestrator.
 * Default: TypeScript WebsiteEditAgent (router + single-shot + tool loop).
 */

import { promises as fs } from 'fs';
import { runWebsiteEditAgent } from './website-edit-agent';
import { runWebsiteEditAgentV2 } from './website-edit-agent-v2';
import { runWebsiteEditAgentV3 } from './edit-agent-v3';
import type { AgentStepEvent } from './website-edit-agent/types';
import { isAllowedWorkspacePath } from './workspaceEditShared';
import { isInfraBaselineReady } from './infra/isInfraBaselineReady';

export type WebsiteEditAgentMode = 'ts' | 'ts-v2' | 'ts-v3';

export interface WebsiteEditResult {
  ok: boolean;
  summary?: string;
  ownerMessage?: string;
  rawOutput?: string;
  error?: string;
  changedFiles?: string[];
  agent?: WebsiteEditAgentMode;
  strategy?: string;
  tier?: string;
  confidence?: string;
  verifyProfile?: string;
  needsClarification?: boolean;
  suggestedReplies?: string[];
  v2Meta?: import('./website-edit-agent/types').WebsiteEditAgentResult['v2Meta'];
  v3Meta?: import('./website-edit-agent/types').WebsiteEditAgentResult['v3Meta'];
}

import type { WorkspaceGateway } from './workspaceGateway';

export interface WebsiteEditOptions {
  workspacePath: string;
  ownerMessage: string;
  projectId: string;
  mode: 'gitlab' | 'static';
  attachments?: import('./workspaceAssetTypes').WorkspaceAssetAttachment[];
  gateway?: WorkspaceGateway;
  conversationHistory?: import('./website-edit-agent/types').ConversationTurn[];
  infraStatus?: 'pending' | 'ready' | 'failed' | string;
  infraVersion?: number;
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
    const useV3 = process.env.WEBSITE_AGENT_V3 === 'true';
    const useV2 = !useV3 && process.env.WEBSITE_AGENT_V2 === 'true';
    return {
      ok: false,
      error: 'Workspace path is not in an allowed directory.',
      agent: useV3 ? 'ts-v3' : useV2 ? 'ts-v2' : 'ts',
    };
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

  const useV3 = process.env.WEBSITE_AGENT_V3 === 'true';
  const useV2 = !useV3 && process.env.WEBSITE_AGENT_V2 === 'true';
  const infraBaselineReady = isInfraBaselineReady({
    infraStatus: options.infraStatus,
    infraVersion: options.infraVersion,
  });
  const agentOptions = {
    workspacePath: options.workspacePath,
    ownerMessage: options.ownerMessage,
    projectId: options.projectId,
    mode: options.mode,
    attachments: options.attachments,
    gateway: options.gateway,
    conversationHistory: options.conversationHistory,
    infraBaselineReady,
  };
  const result = await (useV3
    ? runWebsiteEditAgentV3
    : useV2
      ? runWebsiteEditAgentV2
      : runWebsiteEditAgent)(agentOptions, onStep);

  return {
    ok: result.ok,
    summary: result.summary || result.ownerMessage,
    ownerMessage: result.ownerMessage,
    error: result.error,
    changedFiles: result.changedFiles,
    agent: useV3 ? 'ts-v3' : useV2 ? 'ts-v2' : 'ts',
    strategy: result.strategy,
    tier: result.tier,
    confidence: result.confidence,
    verifyProfile: result.verifyProfile,
    needsClarification: result.needsClarification,
    suggestedReplies: result.suggestedReplies,
    v2Meta: result.v2Meta,
    v3Meta: result.v3Meta,
  };
}
