import { auth } from '@/lib/auth';
import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteProject } from '@/models/WebsiteProject';
import mongoose from 'mongoose';

/**
 * Returns the current session user id, or null if not authenticated.
 */
export async function getServerUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.SITE_AGENT_DEV_BYPASS_AUTH === '1'
  );
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
  const sessionUserId = await getServerUserId();
  return sessionUserId ?? project.ownerId?.toString() ?? null;
}

/**
 * Returns 401 JSON if not authenticated.
 */
export async function requireAuth() {
  const userId = await getServerUserId();
  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }
  return { userId };
}
