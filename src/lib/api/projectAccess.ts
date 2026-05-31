import { auth } from '@/lib/auth';
import { connectMongoDB } from '@/lib/mongodb';
import { User } from '@/models/User';
import { WebsiteProject } from '@/models/WebsiteProject';
import mongoose from 'mongoose';

/** Dev-only: SITE_AGENT_DEV_BYPASS_AUTH=1 skips owner checks and API session requirements. */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.SITE_AGENT_DEV_BYPASS_AUTH === '1'
  );
}

/**
 * Resolve the dev bypass actor from SITE_AGENT_DEV_BYPASS_USER_ID or the oldest user in MongoDB.
 */
export async function resolveDevBypassUserId(): Promise<string | null> {
  if (!isDevAuthBypassEnabled()) {
    return null;
  }

  await connectMongoDB();

  const configured = process.env.SITE_AGENT_DEV_BYPASS_USER_ID?.trim();
  if (configured) {
    try {
      const user = await User.findById(configured).select('_id').lean<{ _id: mongoose.Types.ObjectId }>();
      if (user?._id) {
        return user._id.toString();
      }
      console.warn('[auth] SITE_AGENT_DEV_BYPASS_USER_ID not found — falling back to first user');
    } catch {
      console.warn('[auth] Invalid SITE_AGENT_DEV_BYPASS_USER_ID — falling back to first user');
    }
  }

  const fallback = await User.findOne()
    .sort({ createdAt: 1 })
    .select('_id')
    .lean<{ _id: mongoose.Types.ObjectId }>();
  return fallback?._id?.toString() ?? null;
}

/**
 * Returns the current session user id, or the dev bypass user when enabled locally.
 */
export async function getServerUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }
  return resolveDevBypassUserId();
}

/**
 * Fetches a WebsiteProject by ID, ensuring it belongs to the current authenticated user.
 * Returns null if not found or not owned by the user.
 *
 * Set SITE_AGENT_DEV_BYPASS_AUTH=1 in local .env to load any project by id (dev only).
 */
export async function getOwnerProject(projectId: string) {
  await connectMongoDB();

  let oid: mongoose.Types.ObjectId;
  try {
    oid = new mongoose.Types.ObjectId(projectId);
  } catch {
    return null;
  }

  if (isDevAuthBypassEnabled()) {
    return WebsiteProject.findById(oid);
  }

  const userId = await getServerUserId();
  if (!userId) return null;

  const project = await WebsiteProject.findOne({
    _id: oid,
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  return project;
}

/**
 * User id for project-scoped API routes: session user, or project owner when dev bypass applies.
 */
export async function getProjectActorUserId(
  project: NonNullable<Awaited<ReturnType<typeof getOwnerProject>>>
): Promise<string | null> {
  const actorUserId = await getServerUserId();
  return actorUserId ?? project.ownerId?.toString() ?? null;
}

/**
 * Returns 401 JSON if not authenticated.
 * In local dev with SITE_AGENT_DEV_BYPASS_AUTH=1, uses the configured bypass user.
 */
export async function requireAuth() {
  const userId = await getServerUserId();
  if (!userId) {
    return {
      error: isDevAuthBypassEnabled()
        ? 'Unauthorized — set SITE_AGENT_DEV_BYPASS_USER_ID or sign in'
        : 'Unauthorized',
      status: 401,
    };
  }
  return { userId };
}
