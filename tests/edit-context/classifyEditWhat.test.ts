import { describe, expect, it } from 'vitest';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';

describe('classifyEditWhat', () => {
  it('treats implicit favourite color requests as style background', () => {
    expect(classifyEditWhat('change this to my favourite color')).toBe('style_background');
    expect(classifyEditWhat('change this to my faviourite color')).toBe('style_background');
  });
});
