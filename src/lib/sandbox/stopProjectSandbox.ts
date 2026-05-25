import { clearCachedSandbox, getCachedSandbox, getProjectSandbox } from './sandboxClient';
import { sandboxNameForProject } from './sandboxNames';

/**
 * Best-effort stop of a project's Vercel Sandbox VM on editor release.
 */
export async function stopProjectSandbox(projectId: string): Promise<void> {
  try {
    const cached = getCachedSandbox(projectId);
    if (cached) {
      await cached.stop().catch(() => {});
      clearCachedSandbox(projectId);
      return;
    }

    const name = sandboxNameForProject(projectId);
    try {
      const sandbox = await getProjectSandbox(projectId);
      await sandbox.stop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('not_found') && !msg.includes('404')) {
        console.warn(`[sandbox] stop failed for ${name}:`, msg);
      }
    } finally {
      clearCachedSandbox(projectId);
    }
  } catch (err) {
    console.warn(
      `[sandbox] stopProjectSandbox error for ${projectId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
