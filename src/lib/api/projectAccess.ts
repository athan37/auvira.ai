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

/**
 * Fetches a WebsiteProject by ID, ensuring it belongs to the current authenticated user.
 * Returns null if not found or not owned by the user.
 */
export async function getOwnerProject(projectId: string) {
  const userId = await getServerUserId();
  if (!userId) return null;

  await connectMongoDB();

  let oid: mongoose.Types.ObjectId;
  try {
    oid = new mongoose.Types.ObjectId(projectId);
  } catch {
    return null;
  }

  const project = await WebsiteProject.findOne({
    _id: oid,
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  return project;
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
