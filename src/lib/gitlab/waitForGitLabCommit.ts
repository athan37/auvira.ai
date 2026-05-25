import { GitLabClient } from './gitlabClient';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll GitLab until a commit SHA is visible on the target branch (API propagation delay).
 * @throws If the commit is not visible within the timeout.
 */
export async function waitForGitLabCommit(
  gitlabProjectId: number,
  commitSha: string,
  options: { branch?: string; timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const branch = options.branch || 'main';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 1500;
  const deadline = Date.now() + timeoutMs;
  const client = new GitLabClient();
  const shortSha = commitSha.slice(0, 8);

  while (Date.now() < deadline) {
    try {
      await client.request(
        `/projects/${gitlabProjectId}/repository/commits/${encodeURIComponent(commitSha)}`
      );
      return;
    } catch {
      try {
        const commits = await client.request<Array<{ id: string }>>(
          `/projects/${gitlabProjectId}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=5`
        );
        if (commits.some((c) => c.id === commitSha || c.id.startsWith(shortSha))) {
          return;
        }
      } catch {
        /* retry */
      }
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `GitLab commit ${shortSha} was not visible on branch "${branch}" within ${Math.round(timeoutMs / 1000)}s. Deploy aborted to avoid building stale code.`
  );
}
