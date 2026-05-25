import { pickProductionLiveUrl } from './pickProductionLiveUrl';

/**
 * Prefer a verified stable production alias over a one-off deployment URL.
 */
export function resolveProductionLiveUrl(
  status: string | undefined,
  options: {
    deploymentUrl?: string | null;
    expectedProductionUrl?: string | null;
    aliases?: string[];
  }
): string | null {
  const { deploymentUrl, expectedProductionUrl, aliases } = options;

  if (status === 'ready') {
    return pickProductionLiveUrl({ aliases, deploymentUrl, expectedProductionUrl });
  }

  return deploymentUrl || expectedProductionUrl || null;
}
