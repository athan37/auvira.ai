import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const authMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/mongodb', () => ({
  connectMongoDB: vi.fn(async () => undefined),
}));

const userFindById = vi.hoisted(() => vi.fn());
const userFindOne = vi.hoisted(() => vi.fn());

vi.mock('@/models/User', () => ({
  User: {
    findById: userFindById,
    findOne: userFindOne,
  },
}));

import {
  isDevAuthBypassEnabled,
  requireAuth,
  resolveDevBypassUserId,
} from '@/lib/api/projectAccess';

describe('projectAccess dev bypass', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SITE_AGENT_DEV_BYPASS_AUTH', '1');
    vi.stubEnv('SITE_AGENT_DEV_BYPASS_USER_ID', '');
    authMock.mockReset().mockResolvedValue(null);
    userFindById.mockReset();
    userFindOne.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isDevAuthBypassEnabled is true only in development with flag', () => {
    expect(isDevAuthBypassEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it('requireAuth uses configured bypass user when session is absent', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    vi.stubEnv('SITE_AGENT_DEV_BYPASS_USER_ID', userId);
    userFindById.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: userId }),
    });

    const result = await requireAuth();
    expect(result).toEqual({ userId });
  });

  it('requireAuth prefers session user over bypass', async () => {
    authMock.mockResolvedValue({ user: { id: 'session-user-id' } });
    userFindOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'bypass-user-id' }),
    });

    const result = await requireAuth();
    expect(result).toEqual({ userId: 'session-user-id' });
    expect(userFindOne).not.toHaveBeenCalled();
  });

  it('resolveDevBypassUserId falls back to oldest user', async () => {
    const oldestId = new mongoose.Types.ObjectId().toString();
    userFindOne.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: oldestId }),
    });

    await expect(resolveDevBypassUserId()).resolves.toBe(oldestId);
  });
});
