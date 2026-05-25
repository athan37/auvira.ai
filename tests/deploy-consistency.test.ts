/**
 * Deploy consistency: commit SHA matching and production URL resolution.
 * Run with: npx vitest run tests/deploy-consistency.test.ts
 */

import { describe, it, expect } from 'vitest';
import { commitShaMatches, getDeploymentCommitSha } from '../src/lib/vercel/deploymentCommitSha';
import { resolveProductionLiveUrl } from '../src/lib/vercel/resolveProductionLiveUrl';

describe('deploymentCommitSha', () => {
  it('extracts gitlabCommitSha from meta', () => {
    expect(
      getDeploymentCommitSha({ gitlabCommitSha: '93ed605870d4daf5c82685f0dc5ca39f2f0e5a25' })
    ).toBe('93ed605870d4daf5c82685f0dc5ca39f2f0e5a25');
  });

  it('matches full and short SHAs', () => {
    const full = '93ed605870d4daf5c82685f0dc5ca39f2f0e5a25';
    expect(commitShaMatches(full, '93ed6058')).toBe(true);
    expect(commitShaMatches(full, full)).toBe(true);
    expect(commitShaMatches(full, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')).toBe(false);
  });
});

describe('resolveProductionLiveUrl', () => {
  it('prefers team alias when expected production URL is not assigned', () => {
    expect(
      resolveProductionLiveUrl('ready', {
        deploymentUrl: 'https://my-site-abc123-team.vercel.app',
        expectedProductionUrl: 'https://my-site.vercel.app',
        aliases: ['my-site-athan37s-projects.vercel.app'],
      })
    ).toBe('https://my-site-athan37s-projects.vercel.app');
  });

  it('uses expected production URL when it is in aliases', () => {
    expect(
      resolveProductionLiveUrl('ready', {
        deploymentUrl: 'https://my-site-abc123-team.vercel.app',
        expectedProductionUrl: 'https://my-site.vercel.app',
        aliases: ['my-site.vercel.app'],
      })
    ).toBe('https://my-site.vercel.app');
  });

  it('falls back to deployment URL when not ready', () => {
    expect(
      resolveProductionLiveUrl('building', {
        deploymentUrl: 'https://my-site-abc123-team.vercel.app',
        expectedProductionUrl: 'https://my-site.vercel.app',
      })
    ).toBe('https://my-site-abc123-team.vercel.app');
  });
});
