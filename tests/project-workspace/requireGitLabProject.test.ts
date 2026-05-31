import { describe, it, expect } from 'vitest';
import {
  getUnsupportedProjectReason,
  projectHasGitLabRepo,
  projectSupportsV3Edits,
} from '@/lib/project-workspace/requireGitLabProject';

const validGitlab = {
  projectId: 123,
  repoUrl: 'https://gitlab.com/acme/site',
  httpUrlToRepo: 'https://gitlab.com/acme/site.git',
};

describe('requireGitLabProject', () => {
  it('accepts a fully wired GitLab project', () => {
    const project = {
      gitlab: validGitlab,
      editingMode: 'code',
      codeWorkspace: { source: 'gitlab' },
    };
    expect(projectSupportsV3Edits(project)).toBe(true);
    expect(getUnsupportedProjectReason(project)).toBeNull();
  });

  it('rejects missing gitlab', () => {
    expect(getUnsupportedProjectReason({})).toBe('missing_gitlab');
    expect(getUnsupportedProjectReason({ gitlab: { repoUrl: '' } })).toBe('missing_gitlab');
  });

  it('rejects incomplete gitlab record', () => {
    expect(
      getUnsupportedProjectReason({
        gitlab: { repoUrl: 'https://gitlab.com/x/y', projectId: 0, httpUrlToRepo: '' },
      })
    ).toBe('incomplete_gitlab');
  });

  it('rejects V2 spec editing mode', () => {
    expect(
      getUnsupportedProjectReason({
        gitlab: validGitlab,
        editingMode: 'spec',
      })
    ).toBe('spec_editing_mode');
  });

  it('rejects static HTML workspace path', () => {
    expect(
      getUnsupportedProjectReason({
        gitlab: validGitlab,
        codeWorkspace: {
          workspacePath: '/tmp/project-workspaces/abc123',
          source: 'generated',
        },
      })
    ).toBe('static_workspace_path');
  });

  it('projectHasGitLabRepo is necessary but not sufficient', () => {
    expect(projectHasGitLabRepo({ gitlab: validGitlab })).toBe(true);
    expect(projectSupportsV3Edits({ gitlab: validGitlab, editingMode: 'spec' })).toBe(false);
  });
});
