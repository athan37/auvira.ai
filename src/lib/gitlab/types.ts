export interface GitLabFile {
  filePath: string;
  content: string;
}

export type GitLabCommitAction =
  | { action: 'create'; file_path: string; content: string; encoding?: 'text' | 'base64' }
  | { action: 'update'; file_path: string; content: string; encoding?: 'text' | 'base64' }
  | { action: 'delete'; file_path: string };

export interface CreateProjectInput {
  name: string;
  path?: string;
  description?: string;
}

export interface CommitFilesInput {
  projectId: number;
  branch?: string;
  commitMessage: string;
  files: GitLabFile[];
}

export interface GitLabProjectResult {
  id: number;
  name: string;
  web_url: string;
  http_url_to_repo: string;
  path_with_namespace?: string;
}