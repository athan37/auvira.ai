/**
 * Run with: npx vitest run tests/pick-production-live-url.test.ts
 */

import { describe, it, expect } from 'vitest';
import { pickProductionLiveUrl } from '../src/lib/vercel/pickProductionLiveUrl';
import { resolveProductionLiveUrl } from '../src/lib/vercel/resolveProductionLiveUrl';

describe('pickProductionLiveUrl', () => {
  const teamAliases = [
    'varsity-zone-hvac-of-galleria-uptow-beta.vercel.app',
    'varsity-zone-hvac-of-galleria-upto-git-6d5c1f-athan37s-projects.vercel.app',
    'varsity-zone-hvac-of-galleria-uptown-k7rpp1-o-athan37s-projects.vercel.app',
  ];
  const deploymentUrl =
    'https://varsity-zone-hvac-of-galleria-uptown-k7rpp1-ozvw-3pslaszei.vercel.app';
  const wrongExpected = 'https://varsity-zone-hvac-of-galleria-uptown-k7rpp1-ozvw.vercel.app';

  it('uses team production alias when guessed URL is wrong', () => {
    expect(
      pickProductionLiveUrl({
        aliases: teamAliases,
        deploymentUrl,
        expectedProductionUrl: wrongExpected,
      })
    ).toBe('https://varsity-zone-hvac-of-galleria-uptown-k7rpp1-o-athan37s-projects.vercel.app');
  });

  it('uses expected URL when it appears in aliases', () => {
    expect(
      pickProductionLiveUrl({
        aliases: ['my-site.vercel.app', 'my-site-abc-team.vercel.app'],
        deploymentUrl: 'https://my-site-abc123-team.vercel.app',
        expectedProductionUrl: 'https://my-site.vercel.app',
      })
    ).toBe('https://my-site.vercel.app');
  });
});

describe('resolveProductionLiveUrl', () => {
  it('prefers verified alias over wrong expected URL when ready', () => {
    expect(
      resolveProductionLiveUrl('ready', {
        deploymentUrl: 'https://my-site-abc123-team.vercel.app',
        expectedProductionUrl: 'https://my-site.vercel.app',
        aliases: ['my-site-athan37s-projects.vercel.app'],
      })
    ).toBe('https://my-site-athan37s-projects.vercel.app');
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
