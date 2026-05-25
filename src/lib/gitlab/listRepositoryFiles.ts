import { GitLabClient } from './gitlabClient';

/**
 * List all file paths in a GitLab repository branch (blobs only).
 */
export async function listGitLabRepositoryFilePaths(
  projectId: number,
  ref = 'main'
): Promise<Set<string>> {
  const client = new GitLabClient();
  const paths = new Set<string>();
  let page = 1;

  while (true) {
    const items = await client.request<Array<{ path: string; type: string }>>(
      `/projects/${projectId}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(ref)}`
    );
    if (!items.length) break;

    for (const item of items) {
      if (item.type === 'blob') {
        paths.add(item.path);
      }
    }

    if (items.length < 100) break;
    page += 1;
  }

  return paths;
}
