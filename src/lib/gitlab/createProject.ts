import { GitLabClient } from './gitlabClient';
import type { CreateProjectInput, GitLabProjectResult } from './types';

export async function createGitLabProject(input: CreateProjectInput): Promise<GitLabProjectResult> {
  const client = new GitLabClient();
  const groupId = process.env.GITLAB_GROUP_ID;

  if (!groupId) {
    throw new Error('GITLAB_GROUP_ID is required');
  }

  const projectPath = input.path || input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const body: Record<string, unknown> = {
    name: input.name,
    path: projectPath,
    description: input.description || `Generated website: ${input.name}`,
    namespace_id: groupId,
    visibility: 'public',
  };

  const result = await client.request<GitLabProjectResult>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result;
}