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
      'VERCEL_API_TOKEN',
      'VERCEL_TOKEN',
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

  it('prefers VERCEL_API_TOKEN over legacy VERCEL_TOKEN', () => {
    process.env.VERCEL_TOKEN = 'legacy';
    process.env.VERCEL_API_TOKEN = '  api-token  ';
    expect(getVercelApiToken()).toBe('api-token');
    expect(hasVercelApiToken()).toBe(true);
  });

  it('falls back to VERCEL_TOKEN when API token unset', () => {
    process.env.VERCEL_TOKEN = 'legacy-only';
    expect(getVercelApiToken()).toBe('legacy-only');
  });

  it('prefers VERCEL_API_TEAM_ID over VERCEL_TEAM_ID', () => {
    process.env.VERCEL_TEAM_ID = 'team-a';
    process.env.VERCEL_API_TEAM_ID = 'team-b';
    expect(getVercelTeamId()).toBe('team-b');
  });
});
