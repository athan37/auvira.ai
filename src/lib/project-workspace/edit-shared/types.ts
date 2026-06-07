export type WorkspaceMode = 'gitlab';

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
  | 'image_gallery'
  | 'hero_image'
  | 'gallery_captions'
  | 'section_config'
  | 'section_style'
  | 'contact_field';

export type SectionTargetKind = 'section' | 'hero' | 'nav' | 'footer';

export type EditWhatKind =
  | 'copy'
  | 'style_background'
  | 'style_text'
  | 'style_card'
  | 'structure'
  | 'images';

export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface SectionMatchCandidate {
  index: number;
  type: string;
  title: string;
  rendererComponent?: string;
}

export interface SectionTargetResult {
  confidence: 'high' | 'medium' | 'low';
  kind: SectionTargetKind;
  sectionIndex?: number;
  sectionType?: string;
  title?: string;
  rendererComponent?: string;
  configLineRange?: LineRange;
  pageComponentRange?: LineRange;
  matches?: SectionMatchCandidate[];
  clarificationMessage?: string;
  suggestedReplies?: string[];
  reason?: string;
}

export interface CodeContextBlock {
  path: string;
  startLine: number;
  endLine: number;
  label: string;
  content: string;
}

import type { SiteSectionCatalog } from './siteSectionCatalog';

export interface EditTargetPlan {
  where: SectionTargetResult;
  what: EditWhatKind;
  valueExplicit: boolean;
  codeBlocks: CodeContextBlock[];
  structureBrief: string;
  /** Canonical section list for prompts and disambiguation. */
  sectionCatalog?: SiteSectionCatalog;
}

export interface GroundedEditContextResult {
  needsClarification?: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
  plan?: EditTargetPlan;
  sectionCatalog?: SiteSectionCatalog;
}

/** @deprecated Legacy strategy labels */
export type EditStrategyKind = 'single_shot' | 'agent_loop' | 'image_gallery';

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

export interface LastGalleryEdit {
  sectionIndex: number;
  title: string;
  imageUrls: string[];
  imageCount: number;
}

export type EditFocusKind =
  | 'section_created'
  | 'section_style'
  | 'gallery_captions'
  | 'section_copy'
  | 'hero';

export interface EditFocus {
  kind: EditFocusKind;
  sectionIndex: number;
  sectionTitle: string;
  sectionType?: string;
  imageUrls?: string[];
  imageCount?: number;
  backgroundClass?: string;
  editJobId?: string;
  at: string;
}

export interface EditFocusStack {
  items: EditFocus[];
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
  /** Recent chat turns for disambiguation (latest user message is ownerMessage). */
  conversationHistory?: ConversationTurn[];
  /** Pre-resolved WHERE/WHAT from buildGroundedEditContext. */
  editTargetPlan?: EditTargetPlan;
  /** Last successful gallery image placement (from chat metadata or prior turn). */
  lastGalleryEdit?: LastGalleryEdit;
  /** Recent edit focus stack for N-turn deictic resolution. */
  editFocusStack?: EditFocusStack;
  /** UI-pinned section from preview selection (beats deictic focus). */
  selectedTarget?: import('./selectedTargetTypes').SelectedTargetInput;
  /** Section catalog when grounded context is unavailable but snap exists. */
  sectionCatalog?: import('./siteSectionCatalog').SiteSectionCatalog;
  /** When true, skip inline tailwind/page infra repairs (migration baseline ready). */
  infraBaselineReady?: boolean;
  /** Site Monitor coaching hints (injected when OBSERVABILITY_COACHING_ENABLED=1). */
  coachingContext?: import('@/lib/observability/types').ObservabilityCoachingContext | null;
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
  editMeta?: {
    planVersion?: string;
    intent?: string;
    skills?: string[];
    lastGalleryEdit?: LastGalleryEdit;
  };
  /** Set when an image gallery section was created/updated this turn. */
  lastGalleryEdit?: LastGalleryEdit;
  /** Focus artifact for this turn (merged into editFocusStack by runner). */
  editFocus?: EditFocus;
  /** Updated focus stack after this edit completes. */
  editFocusStack?: EditFocusStack;
}
