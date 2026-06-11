import { describe, it, expect } from 'vitest';
import {
  htmlIncludesText,
  isReservedWorkspacePreviewPort,
  isSiteAgentShellHtml,
} from '../src/lib/preview/workspacePreviewHealth';

describe('workspacePreviewHealth', () => {
  it('reserves Auvira.ai dev port 3000', () => {
    expect(isReservedWorkspacePreviewPort(3000)).toBe(true);
    expect(isReservedWorkspacePreviewPort(3053)).toBe(false);
  });

  it('detects Auvira.ai shell HTML', () => {
    expect(isSiteAgentShellHtml('<a href="/projects/new/scratch">New</a>')).toBe(true);
    expect(isSiteAgentShellHtml('<h1>Houston HVAC All-Stars</h1>')).toBe(false);
  });

  it('matches text with HTML entity encoding', () => {
    const html = '<h1>Beverage &amp; Food Delivery for Your Business</h1>';
    expect(htmlIncludesText(html, 'Beverage & Food Delivery for Your Business')).toBe(true);
    expect(htmlIncludesText(html, 'Missing Name')).toBe(false);
  });
});
