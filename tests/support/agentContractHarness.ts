/**
 * Generic agent contract harness — website-agnostic scratch workspaces + scenario runners.
 * Add new contract modules under tests/support/*Contract.ts and wire them in npm run test:contracts.
 */

export {
  buildSyntheticSiteModel,
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  buildSyntheticSiteConfigSource,
  buildSyntheticPageSource,
  defaultMultiSectionSiteSpec,
  SYNTHETIC_SECTION_TYPES,
  type SyntheticSiteSpec,
  type SyntheticSectionSpec,
  type PageRendererMode,
  type TailwindMode,
} from './syntheticSiteWorkspace';

export {
  runSectionColorEditContract,
  assertSectionColorEditContract,
  withSectionColorContract,
  GENERIC_SECTION_COLOR_SCENARIOS,
  type SectionColorEditScenario,
  type SectionColorEditContractResult,
} from './sectionColorEditContract';

export {
  applySectionBackgroundColorEdit,
  assertSectionColorEditReady,
  assertSectionColorEditInvariants,
} from '@/lib/project-workspace/sectionPresentationEdit';
