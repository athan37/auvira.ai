/**
 * Print hardcoded intent sentences for common edit scenarios (dev probe).
 * Run: npx tsx scripts/probe-hardcoded-intent.ts
 */
import { buildHardcodedIntentSentence } from '../src/lib/observability/hardcodedIntentSentence';
import { resolveImplicitReferences } from '../src/lib/project-workspace/edit-context/implicitReferenceResolver';
import { formatProjectIntentBlock } from '../src/lib/project-workspace/planner/planEditPrompt';

const scenarios = [
  {
    name: 'Favorite color + Contact card pin (project 6a26…)',
    userMessage: 'change background to my favorite color',
    selectedTarget: {
      kind: 'section' as const,
      sectionIndex: 2,
      sectionType: 'contact',
      sectionTitle: 'Contact Us',
      elementLabel: 'Contact Information',
      fieldPath: 'sections[2].presentation.cardClass',
    },
  },
  {
    name: 'Explicit blue section background',
    userMessage: 'make the services section background blue',
    selectedTarget: {
      kind: 'section' as const,
      sectionIndex: 1,
      sectionTitle: 'Services',
      fieldPath: 'sections[1].presentation.backgroundClass',
    },
  },
  {
    name: 'Hero headline copy',
    userMessage: 'change headline to "Schedule Your Free Consultation"',
    selectedTarget: {
      kind: 'hero' as const,
      fieldPath: 'hero.headline',
      elementLabel: 'Hero headline',
    },
  },
];

async function main() {
  for (const scenario of scenarios) {
    const intent = buildHardcodedIntentSentence({
      userMessage: scenario.userMessage,
      selectedTarget: scenario.selectedTarget,
    });

    console.log('\n===', scenario.name, '===');
    console.log('User:', scenario.userMessage);
    console.log('Intent:', intent.sentence);
    console.log('Planner block:\n', formatProjectIntentBlock(intent));

    const resolution = await resolveImplicitReferences({
      ownerMessage: scenario.userMessage,
      editContext: {
        workspacePath: '/tmp',
        mode: 'gitlab',
        ownerMessage: scenario.userMessage,
        effectiveMessage: scenario.userMessage,
        siteModel: {} as never,
        sectionCatalog: {} as never,
        sections: [],
        target: {
          kind: 'section',
          sectionIndex: scenario.selectedTarget.sectionIndex ?? 0,
          title: scenario.selectedTarget.sectionTitle ?? 'Section',
          confidence: 'high',
          candidates: [],
          needsClarification: false,
        },
      },
      projectIntent: intent,
    });

    console.log(
      'Resolver:',
      resolution.needsClarification
        ? `CLARIFY: ${resolution.clarificationMessage}`
        : resolution.references.map((r) => `${r.phrase} → ${r.resolvedValue} (${r.source})`).join('; ')
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
