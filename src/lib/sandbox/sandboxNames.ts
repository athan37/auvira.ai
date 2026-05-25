import mongoose from 'mongoose';

const NAME_PREFIX = 'site-agent-';

/**
 * Stable sandbox name for a project. Only ObjectId hex characters after prefix.
 */
export function sandboxNameForProject(projectId: string): string {
  const hex = projectId.replace(/[^a-f0-9]/gi, '').toLowerCase();
  if (!hex || !mongoose.Types.ObjectId.isValid(hex)) {
    throw new Error('Invalid project id for sandbox name');
  }
  return `${NAME_PREFIX}${hex}`;
}

/** Validate a sandbox name matches our naming convention. */
export function isValidSandboxName(name: string): boolean {
  return /^site-agent-[a-f0-9]{24}$/.test(name);
}
