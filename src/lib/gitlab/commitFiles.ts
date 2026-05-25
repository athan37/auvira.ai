import { GitLabClient } from './gitlabClient';
import type { CommitFilesInput, GitLabCommitAction } from './types';

interface GitLabCommitResponse {
  id?: string;
  short_id?: string;
}

/**
 * Commit explicit create/update/delete actions via GitLab API (no local git push).
 */
export async function commitActionsToGitLab(input: {
  projectId: number;
  branch?: string;
  commitMessage: string;
  actions: GitLabCommitAction[];
}): Promise<GitLabCommitResponse> {
  if (input.actions.length === 0) {
    throw new Error('No file actions to commit');
  }

  const client = new GitLabClient();
  const branch = input.branch || 'main';

  const result = await client.request<GitLabCommitResponse>(
    `/projects/${input.projectId}/repository/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        branch,
        commit_message: input.commitMessage,
        actions: input.actions,
      }),
    }
  );

  return result;
}

export async function commitFilesToGitLab(input: CommitFilesInput): Promise<unknown> {
  const client = new GitLabClient();
  const branch = input.branch || 'main';

  const actions = input.files.map(file => ({
    action: 'create' as const,
    file_path: file.filePath,
    content: file.content,
  }));

  const body = {
    branch,
    commit_message: input.commitMessage,
    actions,
  };

  try {
    const result = await client.request<unknown>(`/projects/${input.projectId}/repository/commits`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '';
    // Check for 404 - project not found
    if (errorMsg.includes('404')) {
      const notFoundError = new Error('GitLab project not found');
      (notFoundError as any).code = 'PROJECT_NOT_FOUND';
      throw notFoundError;
    }
    // Check if it's a conflict (file already exists) - GitLab returns 400 or 409
    if (errorMsg.includes('400') || errorMsg.includes('409') || errorMsg.includes('A file with this name already exists')) {
      const updateActions = input.files.map(file => ({
        action: 'update' as const,
        file_path: file.filePath,
        content: file.content,
      }));

      const retryBody = {
        branch,
        commit_message: input.commitMessage,
        actions: updateActions,
      };

      try {
        return await client.request<unknown>(`/projects/${input.projectId}/repository/commits`, {
          method: 'POST',
          body: JSON.stringify(retryBody),
        });
      } catch (retryError) {
        // Check for 404 on retry as well
        const retryMsg = retryError instanceof Error ? retryError.message : '';
        if (retryMsg.includes('404')) {
          const notFoundError = new Error('GitLab project not found');
          (notFoundError as any).code = 'PROJECT_NOT_FOUND';
          throw notFoundError;
        }
        throw retryError;
      }
    }
    throw error;
  }
}