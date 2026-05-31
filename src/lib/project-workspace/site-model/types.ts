import type { ParsedSiteConfig } from '@/lib/site-manager/siteConfigParser';
import type { EnrichedSiteStructureSnapshot } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import type {
  PageArchetype,
  SiteWorkspaceSnapshot,
} from '@/lib/project-workspace/edit-shared/resolveSiteWorkspace';
import type { WorkspaceMode } from '@/lib/project-workspace/edit-shared/types';

/** Deterministic view of a workspace homepage for V2 planning. */
export interface SiteModel extends SiteWorkspaceSnapshot {
  workspacePath: string;
  mode: WorkspaceMode;
  archetype: PageArchetype;
  parsedConfig: ParsedSiteConfig | null;
  structure: EnrichedSiteStructureSnapshot | null;
  /** Non-fatal issues encountered while building the model. */
  errors: string[];
}

export interface GetSiteModelInput {
  workspacePath: string;
  mode?: WorkspaceMode;
  gateway?: import('@/lib/project-workspace/workspaceGateway').WorkspaceGateway;
}
