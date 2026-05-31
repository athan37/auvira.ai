import type { WorkspaceProfile } from '../types';
import { gitlabNextProfile } from './gitlabNext';

/** GitLab-only workspaces (V3 edit agent). */
export function getProfileForMode(_mode: 'gitlab'): WorkspaceProfile {
  return gitlabNextProfile;
}
