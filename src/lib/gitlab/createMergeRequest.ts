import { GitLabClient } from './gitlabClient';

export async function createMergeRequest(
  projectId: number,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  description?: string
): Promise<unknown> {
  const client = new GitLabClient();

  const body = {
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title,
    description: description || '',
  };

  return await client.request(`/projects/${projectId}/merge_requests`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}