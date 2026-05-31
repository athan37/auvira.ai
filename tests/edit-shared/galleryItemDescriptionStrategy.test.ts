import { describe, it, expect } from 'vitest';
import { isGalleryDescriptionRequest } from '../../src/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy';

describe('isGalleryDescriptionRequest', () => {
  it('matches follow-up caption requests', () => {
    expect(isGalleryDescriptionRequest('can you also add description for these image')).toBe(
      true
    );
    expect(isGalleryDescriptionRequest('add captions for the photos')).toBe(true);
  });

  it('matches singular that-image follow-up', () => {
    expect(isGalleryDescriptionRequest('add some description to that image')).toBe(true);
  });

  it('matches split-compound caption phrase and partial finish-the-rest', () => {
    expect(isGalleryDescriptionRequest('label each pic.')).toBe(true);
    expect(isGalleryDescriptionRequest('finish the rest')).toBe(true);
  });

  it('does not match unrelated edits', () => {
    expect(isGalleryDescriptionRequest('change background to blue')).toBe(false);
    expect(isGalleryDescriptionRequest('update phone number')).toBe(false);
  });
});
