import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteProject } from '@/models/WebsiteProject';
import mongoose from 'mongoose';
import { rewritePreviewAssetPaths } from './previewProxyRewrite';

/**
 * Server-side preview HTML for gallery verify (no owner session required).
 * Fetches the sandbox dev URL and applies the same asset rewrites as the iframe proxy.
 */
export async function fetchSandboxPreviewHtmlForVerify(projectId: string): Promise<string> {
  await connectMongoDB();

  let oid: mongoose.Types.ObjectId;
  try {
    oid = new mongoose.Types.ObjectId(projectId);
  } catch {
    return '';
  }

  const project = await WebsiteProject.findById(oid);
  const previewUrl = project?.preview?.url?.trim();
  if (!previewUrl) return '';

  const target = `${previewUrl.replace(/\/$/, '')}/?_sa_verify=${Date.now()}`;
  try {
    const res = await fetch(target, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return '';
    const text = await res.text();
    if (text.length < 500) return text;
    return rewritePreviewAssetPaths(text, projectId);
  } catch {
    return '';
  }
}
