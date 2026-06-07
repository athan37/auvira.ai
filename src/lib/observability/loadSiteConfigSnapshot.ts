import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';

/** Best-effort parsed siteConfig for observability snapshots (non-throwing). */
export async function loadSiteConfigForObservability(input: {
  workspacePath: string;
  gateway?: WorkspaceGateway;
}): Promise<{
  businessName?: string;
  sections?: Array<{ type?: string; title?: string; items?: unknown[] }>;
} | null> {
  try {
    const model = await getSiteModel({
      workspacePath: input.workspacePath,
      mode: 'gitlab',
      gateway: input.gateway,
    });
    if (!model.parsedConfig) return null;
    return {
      businessName: model.parsedConfig.businessName,
      sections: model.parsedConfig.sections,
    };
  } catch {
    return null;
  }
}
