import { describe, it, expect } from 'vitest';
import { isGalleryDescriptionRequest } from '../../src/lib/project-workspace/website-edit-agent/galleryItemDescriptionStrategy';

describe('isGalleryDescriptionRequest', () => {
  it('matches follow-up caption requests', () => {
    expect(isGalleryDescriptionRequest('can you also add description for these image')).toBe(
      true
    );
    expect(isGalleryDescriptionRequest('add captions for the photos')).toBe(true);
  });

  it('does not match unrelated edits', () => {
    expect(isGalleryDescriptionRequest('change background to blue')).toBe(false);
    expect(isGalleryDescriptionRequest('update phone number')).toBe(false);
  });
});
