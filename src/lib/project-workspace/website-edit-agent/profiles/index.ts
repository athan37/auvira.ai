import type { WorkspaceMode, WorkspaceProfile } from '../types';
import { gitlabNextProfile } from './gitlabNext';
import { staticHtmlProfile } from './staticHtml';

export function getProfileForMode(mode: WorkspaceMode): WorkspaceProfile {
  return mode === 'static' ? staticHtmlProfile : gitlabNextProfile;
}
