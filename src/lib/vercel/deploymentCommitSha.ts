/** Extract Git commit SHA from Vercel deployment metadata. */
export function getDeploymentCommitSha(meta?: Record<string, string> | null): string | null {
  if (!meta) return null;

  const candidates = [
    meta.gitlabCommitSha,
    meta.githubCommitSha,
    meta.gitCommitSha,
    meta.commitSha,
    meta.COMMIT_SHA,
    meta.GITLAB_COMMIT_SHA,
  ].filter(Boolean);

  for (const value of candidates) {
    if (value && value.length >= 7) return value;
  }

  return null;
}

export function commitShaMatches(expected: string, actual: string | null | undefined): boolean {
  if (!expected || !actual) return false;
  const e = expected.toLowerCase();
  const a = actual.toLowerCase();
  return a === e || a.startsWith(e.slice(0, 8)) || e.startsWith(a.slice(0, 8));
}
