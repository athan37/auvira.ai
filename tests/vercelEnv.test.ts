import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getVercelApiToken,
  getVercelTeamId,
  hasVercelApiToken,
} from '../src/lib/vercel/vercelEnv';

describe('vercelEnv', () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'SITE_AGENT_VERCEL_TOKEN',
      'VERCEL_API_TOKEN',
      'VERCEL_TOKEN',
      'SITE_AGENT_VERCEL_TEAM_ID',
      'VERCEL_API_TEAM_ID',
      'VERCEL_TEAM_ID',
    ]) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prefers SITE_AGENT_VERCEL_TOKEN over legacy names', () => {
    process.env.VERCEL_TOKEN = 'legacy';
    process.env.VERCEL_API_TOKEN = 'api';
    process.env.SITE_AGENT_VERCEL_TOKEN = '  site-agent-token  ';
    expect(getVercelApiToken()).toBe('site-agent-token');
    expect(hasVercelApiToken()).toBe(true);
  });

  it('falls back to VERCEL_TOKEN when API token unset', () => {
    process.env.VERCEL_TOKEN = 'legacy-only';
    expect(getVercelApiToken()).toBe('legacy-only');
  });

  it('prefers SITE_AGENT_VERCEL_TEAM_ID over legacy team ids', () => {
    process.env.VERCEL_TEAM_ID = 'team-a';
    process.env.SITE_AGENT_VERCEL_TEAM_ID = 'team-b';
    expect(getVercelTeamId()).toBe('team-b');
  });
});
