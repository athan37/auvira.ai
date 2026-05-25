import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { isValidSandboxName, sandboxNameForProject } from '@/lib/sandbox/sandboxNames';

describe('sandboxNames', () => {
  const projectId = new mongoose.Types.ObjectId().toString();

  it('builds stable site-agent name from project id', () => {
    expect(sandboxNameForProject(projectId)).toBe(`site-agent-${projectId}`);
  });

  it('rejects invalid project ids', () => {
    expect(() => sandboxNameForProject('not-an-object-id')).toThrow(/Invalid project id/);
  });

  it('validates sandbox naming convention', () => {
    expect(isValidSandboxName(`site-agent-${projectId}`)).toBe(true);
    expect(isValidSandboxName('site-agent-abc')).toBe(false);
  });
});
