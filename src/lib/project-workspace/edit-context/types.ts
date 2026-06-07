import type { AmbiguityReason } from './assessEditAmbiguity';
import type { SiteSectionPresentation } from '@/lib/builder/sectionPresentation';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import type { EditFocusStack } from '@/lib/project-workspace/edit-shared/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { SiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { WorkspaceMode } from '@/lib/project-workspace/edit-shared/types';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import type { SelectedTargetContext } from './selectedTargetContext';

export type EditIntentKind =
  | 'copy'
  | 'contact'
  | 'style'
  | 'section'
  | 'image'
  | 'theme'
  | 'clarification'
  | 'general';

export type RiskLevel = 'low' | 'medium' | 'high';

export type EditTargetKind =
  | 'section'
  | 'hero'
  | 'nav'
  | 'footer'
  | 'site'
  | 'action_value'
  | 'action_cta';

/** Section row in EditContext with presentation and renderer metadata. */
export interface EditSectionInfo {
  index: number;
  type: string;
  title: string;
  presentation?: SiteSectionPresentation;
  rendererComponent?: string;
  itemCount?: number;
}

/** Candidate target when resolution is ambiguous. */
export interface EditTargetCandidate {
  kind: EditTargetKind;
  sectionIndex?: number;
  sectionTitle?: string;
  sectionType?: string;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

/** Resolved or ambiguous edit target. */
export interface EditTarget {
  kind: EditTargetKind;
  sectionIndex?: number;
  sectionType?: string;
  title?: string;
  rendererComponent?: string;
  confidence: 'high' | 'medium' | 'low';
  candidates: EditTargetCandidate[];
  needsClarification: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
  reason?: string;
  /** Pinned config field path when target resolves to a leaf element. */
  fieldPath?: string;
}

export type VerificationCheckKind =
  | 'section_background'
  | 'section_items'
  | 'contact_field'
  | 'hero_field'
  | 'business_name'
  | 'copy_field'
  | 'theme'
  | 'generic';

/** Hard source invariant expected after a domain tool runs. */
export interface VerificationCheck {
  kind: VerificationCheckKind;
  sectionIndex?: number;
  field?: string;
  expectedValue?: string;
  expectedPattern?: string;
  operation?: 'add' | 'remove' | 'duplicate' | 'update';
  itemIndex?: number;
  expectedLengthDelta?: number;
  expectedInsertIndex?: number;
}

export interface VerificationContract {
  checks: VerificationCheck[];
}

export interface RiskFlags {
  level: RiskLevel;
  compoundIntent: boolean;
  lowConfidenceTarget: boolean;
  infraNotReady: boolean;
  legacyArchetype: boolean;
  reasons: string[];
}

export interface ContextSnippet {
  path: string;
  startLine: number;
  endLine: number;
  label: string;
  content: string;
}

/** Canonical pre-plan context for Website Edit Agent. */
export interface EditContext {
  workspacePath: string;
  mode: WorkspaceMode;
  ownerMessage: string;
  effectiveMessage: string;
  siteModel: SiteModel;
  sectionCatalog: SiteSectionCatalog;
  sections: EditSectionInfo[];
  target: EditTarget;
  selectedSnippets: ContextSnippet[];
  allowedWritePaths: string[];
  riskFlags: RiskFlags;
  verificationContract: VerificationContract;
  infraBaselineReady: boolean;
  gateway?: import('@/lib/project-workspace/workspaceGateway').WorkspaceGateway;
  conversationHistory?: ConversationTurn[];
  editFocusStack?: EditFocusStack;
  selectedTarget?: SelectedTargetInput;
  selectedTargetContext?: SelectedTargetContext;
}

export interface BuildEditContextInput {
  workspacePath: string;
  mode: WorkspaceMode;
  ownerMessage: string;
  conversationHistory?: ConversationTurn[];
  gateway?: import('@/lib/project-workspace/workspaceGateway').WorkspaceGateway;
  infraBaselineReady?: boolean;
  editFocusStack?: EditFocusStack;
  selectedTarget?: SelectedTargetInput;
}

export interface BuildEditContextResult {
  context: EditContext;
  needsClarification: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
  guidanceHints?: string[];
  ambiguityReasons?: AmbiguityReason[];
}
