function normalizeHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function toHttpsUrl(host: string): string {
  return host.startsWith('http') ? host : `https://${host}`;
}

export interface PickProductionLiveUrlInput {
  aliases?: string[];
  deploymentUrl?: string | null;
  expectedProductionUrl?: string | null;
}

/**
 * Choose the best public URL for a ready Vercel deployment.
 * Team projects often use `{project}-{team}-projects.vercel.app`, not `{project}.vercel.app`.
 */
export function pickProductionLiveUrl(input: PickProductionLiveUrlInput): string | null {
  const { aliases = [], deploymentUrl, expectedProductionUrl } = input;
  const deploymentHost = deploymentUrl ? normalizeHost(deploymentUrl) : null;

  if (expectedProductionUrl) {
    const expectedHost = normalizeHost(expectedProductionUrl);
    if (aliases.includes(expectedHost)) {
      return toHttpsUrl(expectedHost);
    }
  }

  const nonGitAliases = aliases.filter((alias) => !alias.includes('-git-'));

  const teamAlias = nonGitAliases.find((alias) => alias.endsWith('-projects.vercel.app'));
  if (teamAlias) {
    return toHttpsUrl(teamAlias);
  }

  if (deploymentHost) {
    const stableAlias = nonGitAliases.find(
      (alias) => alias !== deploymentHost && !deploymentHost.startsWith(`${alias}-`)
    );
    if (stableAlias) {
      return toHttpsUrl(stableAlias);
    }
  }

  if (nonGitAliases.length > 0) {
    return toHttpsUrl(nonGitAliases[0]);
  }

  if (aliases.length > 0) {
    return toHttpsUrl(aliases[0]);
  }

  return deploymentUrl || expectedProductionUrl || null;
}
