import { describe, it, expect } from 'vitest';
import {
  isGalleryDescriptionRequest,
  isSectionCardDescriptionRequest,
  selectedTargetHasTitleOnlyItems,
} from '../../src/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy';

describe('isSectionCardDescriptionRequest', () => {
  it('matches section card description requests', () => {
    expect(
      isSectionCardDescriptionRequest('add descriptions to these card inside the section')
    ).toBe(true);
    expect(isSectionCardDescriptionRequest('add descriptions to these cards in the section')).toBe(
      true
    );
    expect(isSectionCardDescriptionRequest('write blurbs for each service item')).toBe(true);
    expect(isSectionCardDescriptionRequest('add captions to the feature tiles')).toBe(true);
  });

  it('does not match gallery image caption requests', () => {
    expect(isSectionCardDescriptionRequest('add captions for the photos')).toBe(false);
    expect(isSectionCardDescriptionRequest('add description for these image')).toBe(false);
    expect(isSectionCardDescriptionRequest('add some description to that image')).toBe(false);
    expect(isSectionCardDescriptionRequest('label each pic.')).toBe(false);
  });
});

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

  it('does not match section card description requests', () => {
    expect(
      isGalleryDescriptionRequest('add descriptions to these card inside the section')
    ).toBe(false);
    expect(isGalleryDescriptionRequest('add descriptions to these cards in the section')).toBe(
      false
    );
  });

  it('does not match unrelated edits', () => {
    expect(isGalleryDescriptionRequest('change background to blue')).toBe(false);
    expect(isGalleryDescriptionRequest('update phone number')).toBe(false);
  });
});

describe('selectedTargetHasTitleOnlyItems', () => {
  const servicesConfig = `export const siteConfig = {
  sections: [
    {
      type: 'services',
      title: 'Our Services',
      items: [
        { title: 'Client Management' },
        { title: 'Team Management' },
      ],
    },
  ],
};`;

  const galleryConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Photos',
      items: [{ title: 'A', imageUrl: '/uploads/a.png' }],
    },
  ],
};`;

  it('returns true for pinned section with title-only items', () => {
    expect(
      selectedTargetHasTitleOnlyItems(servicesConfig, {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'services',
      })
    ).toBe(true);
  });

  it('returns false for pinned gallery section with images', () => {
    expect(
      selectedTargetHasTitleOnlyItems(galleryConfig, {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'gallery',
      })
    ).toBe(false);
  });
});
