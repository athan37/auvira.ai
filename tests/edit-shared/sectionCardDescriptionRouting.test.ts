import { describe, it, expect } from 'vitest';
import { computeWorkspaceHashes } from '../../src/lib/project-workspace/workspaceEditShared';
import {
  isGalleryDescriptionRequest,
  isSectionCardDescriptionRequest,
} from '../../src/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy';
import { isCaptionOnlyFollowUp } from '../../src/lib/project-workspace/edit-shared/imageEditIntent';
import { routeAttachmentEdits } from '../../src/lib/project-workspace/edit-shared/runImageGalleryPipeline';
import { createInnerElementStyleWorkspace } from '../support/innerElementStyleWorkspace';

const USER_PROMPT = 'add descriptions to these card inside the section';

const SERVICE_CARDS = [
  { title: 'Client Management' },
  { title: 'Team Management' },
  { title: 'Scheduling' },
  { title: 'Invoicing' },
  { title: 'Reporting' },
  { title: 'Mobile App' },
];

describe('sectionCardDescriptionRouting', () => {
  it('classifies services card description prompt as section cards, not gallery', () => {
    expect(isSectionCardDescriptionRequest(USER_PROMPT)).toBe(true);
    expect(isGalleryDescriptionRequest(USER_PROMPT)).toBe(false);
    expect(isCaptionOnlyFollowUp(USER_PROMPT, false)).toBe(false);
  });

  it('routeAttachmentEdits returns null so V3 agent can handle card descriptions', async () => {
    const { workspacePath, targetSectionIndex, analyticsId } =
      await createInnerElementStyleWorkspace({
        section: {
          type: 'services',
          title: 'Everything you need to run your business',
          body: 'All-in-one platform for home service pros.',
          items: SERVICE_CARDS,
        },
      });

    const beforeHashes = await computeWorkspaceHashes(workspacePath);
    const result = await routeAttachmentEdits(
      {
        workspacePath,
        ownerMessage: USER_PROMPT,
        projectId: 'test-project',
        mode: 'gitlab',
        selectedTarget: {
          kind: 'section',
          sectionIndex: targetSectionIndex,
          sectionType: 'services',
          sectionTitle: 'Everything you need to run your business',
          sectionId: analyticsId,
          analyticsId,
        },
      },
      beforeHashes
    );

    expect(result).toBeNull();
  });
});
