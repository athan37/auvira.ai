import { describe, it, expect } from 'vitest';
import {
  buildEditFailureReport,
  serializeThrownError,
} from '../src/lib/project-workspace/editFailureDetail';

describe('editFailureDetail', () => {
  it('builds copyable trace with context', () => {
    const report = buildEditFailureReport({
      jobId: 'job123',
      projectId: 'proj456',
      stage: 'agent_failed',
      ownerMessage: 'Could not apply change',
      technicalMessage: 'Status code 400 is not ok',
      context: { sandbox: true, attachmentCount: 4, strategy: 'image_gallery' },
    });

    expect(report.copyText).toContain('jobId: job123');
    expect(report.copyText).toContain('projectId: proj456');
    expect(report.copyText).toContain('attachmentCount: 4');
    expect(report.copyText).toContain('400 is not ok');
    expect(report.metadata.copyText).toBe(report.copyText);
  });

  it('redacts token-like substrings in stack', () => {
    const err = new Error('GITLAB_TOKEN=secret123 failed');
    const fields = serializeThrownError(err);
    expect(String(fields.message)).not.toContain('secret123');
    expect(String(fields.message)).toContain('[REDACTED]');
  });
});
