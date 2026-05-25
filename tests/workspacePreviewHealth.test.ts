import { describe, it, expect } from 'vitest';
import {
  isReservedWorkspacePreviewPort,
  isSiteAgentShellHtml,
} from '../src/lib/preview/workspacePreviewHealth';

describe('workspacePreviewHealth', () => {
  it('reserves Site Agent dev port 3000', () => {
    expect(isReservedWorkspacePreviewPort(3000)).toBe(true);
    expect(isReservedWorkspacePreviewPort(3053)).toBe(false);
  });

  it('detects Site Agent shell HTML', () => {
    expect(isSiteAgentShellHtml('<a href="/projects/new/scratch">New</a>')).toBe(true);
    expect(isSiteAgentShellHtml('<h1>Houston HVAC All-Stars</h1>')).toBe(false);
  });
});
