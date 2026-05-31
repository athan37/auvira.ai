import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { buildEnrichedSiteStructure } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  detectPageArchetype,
  resolveSiteWorkspace,
} from '@/lib/project-workspace/edit-shared/resolveSiteWorkspace';
import type { GetSiteModelInput, SiteModel } from './types';

function emptySiteModel(workspacePath: string, errors: string[]): SiteModel {
  return {
    workspacePath,
    mode: 'gitlab',
    archetype: 'hardcoded',
    siteConfigPath: null,
    pagePath: null,
    indexHtmlPath: null,
    siteJsonPath: null,
    stylesPath: null,
    siteConfigContent: null,
    pageContent: null,
    indexHtmlContent: null,
    siteJsonContent: null,
    parsedConfig: null,
    structure: null,
    errors,
  };
}

/**
 * Build a best-effort SiteModel from workspace files. Never throws.
 */
export async function getSiteModel(input: GetSiteModelInput): Promise<SiteModel> {
  const mode = input.mode ?? 'gitlab';
  const errors: string[] = [];

  try {
    const snapshot = await resolveSiteWorkspace({
      workspacePath: input.workspacePath,
      mode,
      gateway: input.gateway,
    });

    let parsedConfig = null;
    if (snapshot.siteConfigContent) {
      parsedConfig = parseSiteConfigSource(snapshot.siteConfigContent);
      if (!parsedConfig) {
        errors.push('siteConfig.ts could not be parsed');
      }
    }

    let structure = null;
    if (snapshot.siteConfigContent && snapshot.pageContent) {
      try {
        structure = buildEnrichedSiteStructure(
          snapshot.siteConfigContent,
          snapshot.pageContent
        );
      } catch (err) {
        errors.push(
          err instanceof Error ? err.message : 'Failed to build enriched site structure'
        );
      }
    } else if (!snapshot.siteConfigContent || !snapshot.pageContent) {
      errors.push('Missing siteConfig or page content for structure analysis');
    }

    const archetype =
      snapshot.archetype ??
      detectPageArchetype(snapshot.pageContent, snapshot.siteConfigContent);

    return {
      workspacePath: input.workspacePath,
      ...snapshot,
      mode,
      archetype,
      parsedConfig,
      structure,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'resolveSiteWorkspace failed');
    return emptySiteModel(input.workspacePath, errors);
  }
}
