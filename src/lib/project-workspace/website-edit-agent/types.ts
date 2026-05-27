export type WorkspaceMode = 'gitlab' | 'static';

export type EditIntent =
  | 'style'
  | 'copy'
  | 'section'
  | 'contact'
  | 'chrome'
  | 'meta'
  | 'layout'
  | 'general';

export type EditTier = 'L0' | 'L1' | 'L2' | 'L3';

export type EditJobConfidence = 'high' | 'medium' | 'low';

export type VerifyProfile = 'color' | 'copy' | 'section' | 'image' | 'contact' | 'generic';

export type EditStrategyId =
  | 'preset_theme'
  | 'preset_card_color'
  | 'preset_text_color'
  | 'copy_field'
  | 'contact_field'
  | 'section_remove'
  | 'section_reorder'
  | 'section_faq_template'
  | 'chrome_field'
  | 'meta_field'
  | 'static_theme'
  | 'static_copy'
  | 'image_gallery'
  | 'hero_image'
  | 'gallery_captions'
  | 'static_gallery'
  | 'single_shot'
  | 'section_config'
  | 'agent_loop';

/** @deprecated Legacy strategy labels; prefer EditStrategyId */
export type EditStrategyKind = 'single_shot' | 'agent_loop' | 'image_gallery';

export interface EditJobPlan {
  intents: EditIntent[];
  tier: EditTier;
  primaryStrategy: EditStrategyId;
  tryOrder: EditStrategyId[];
  confidence: EditJobConfidence;
  verifyProfile: VerifyProfile;
  applyLabel: string;
  /** When true, stream may ask user to clarify before running agent */
  needsClarification?: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
}

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

export type ConversationTurn = { role: 'user' | 'assistant'; content: string };

export interface WebsiteEditAgentOptions {
  workspacePath: string;
  ownerMessage: string;
  /** Enriched prompt with file context; agent loop uses this when set. */
  agentPrompt?: string;
  projectId: string;
  mode: WorkspaceMode;
  attachments?: import('../workspaceAssetTypes').WorkspaceAssetAttachment[];
  gateway?: WorkspaceGateway;
  /** Recent chat turns for disambiguation (latest user message is ownerMessage). */
  conversationHistory?: ConversationTurn[];
}

export interface WebsiteEditAgentResult {
  ok: boolean;
  summary?: string;
  ownerMessage?: string;
  error?: string;
  changedFiles?: string[];
  strategy?: EditStrategyId;
  tier?: EditTier;
  confidence?: EditJobConfidence;
  verifyProfile?: VerifyProfile;
  /** Ask-back only — no files changed; UI should not treat as hard failure. */
  needsClarification?: boolean;
  suggestedReplies?: string[];
}

export interface RouterDecision {
  intent: EditIntent;
  strategy: EditStrategyKind;
  applyLabel: string;
}
