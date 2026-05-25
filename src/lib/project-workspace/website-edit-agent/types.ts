export type WorkspaceMode = 'gitlab' | 'static';

export type EditIntent = 'style' | 'copy' | 'section' | 'contact' | 'general';

export type EditStrategyKind = 'single_shot' | 'agent_loop';

export interface AgentStepEvent {
  type: 'step';
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface AgentAction {
  thought: string;
  action: {
    tool: string;
    args: Record<string, unknown>;
  };
}

export interface ToolResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

import type { WorkspaceGateway } from '../workspaceGateway';

export interface ToolContext {
  workspacePath: string;
  mode: WorkspaceMode;
  ownerMessage: string;
  changedFiles: string[];
  beforeFiles: Record<string, string>;
  afterFiles: Record<string, string>;
  recordChange: (relativePath: string, content?: string) => void;
  gateway?: WorkspaceGateway;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<ToolResult>;

export interface WorkspaceProfile {
  id: string;
  mode: WorkspaceMode;
  systemPrompt: string;
  toolNames: string[];
  maxIterations: number;
}

export interface WebsiteEditAgentOptions {
  workspacePath: string;
  ownerMessage: string;
  /** Enriched prompt with file context; agent loop uses this when set. */
  agentPrompt?: string;
  projectId: string;
  mode: WorkspaceMode;
  attachments?: import('../workspaceAssetTypes').WorkspaceAssetAttachment[];
  gateway?: WorkspaceGateway;
}

export interface WebsiteEditAgentResult {
  ok: boolean;
  summary?: string;
  ownerMessage?: string;
  error?: string;
  changedFiles?: string[];
  strategy?: EditStrategyKind;
}

export interface RouterDecision {
  intent: EditIntent;
  strategy: EditStrategyKind;
  applyLabel: string;
}
