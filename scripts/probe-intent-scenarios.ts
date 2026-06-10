/**
 * Probe live Monitor POST /intent for multiple scenarios.
 * OBSERVABILITY_INTENT_HARDCODE=0 node --env-file=.env npx tsx scripts/probe-intent-scenarios.ts [projectId]
 */
import { fetchObservabilityIntentRaw } from '../src/lib/observability/client';
import { fetchObservabilityIntent } from '../src/lib/observability/fetchObservabilityIntent';
import { serializeSelectedTargetForMonitor } from '../src/lib/observability/serializeTurnContext';
import type { SelectedTargetInput } from '../src/lib/project-workspace/edit-shared/selectedTargetTypes';

const projectId = process.argv[2] ?? '6a26cc3deeea946b980a52da';

const scenarios: Array<{
  name: string;
  userMessage: string;
  selectedTarget?: SelectedTargetInput;
}> = [
  {
    name: 'Favorite color + Contact card pin (section 2)',
    userMessage: 'change background to my favorite color',
    selectedTarget: {
      kind: 'section',
      sectionIndex: 2,
      sectionType: 'contact',
      sectionTitle: 'Contact Us',
      elementLabel: 'Contact Information',
      fieldPath: 'sections[2].presentation.cardClass',
    },
  },
  {
    name: 'Explicit blue services background',
    userMessage: 'make the services section background blue',
    selectedTarget: {
      kind: 'section',
      sectionIndex: 1,
      sectionTitle: 'Services',
      fieldPath: 'sections[1].presentation.backgroundClass',
    },
  },
  {
    name: 'Default probe (section 1 contact, no field pin)',
    userMessage: 'make the contact section background my favorite color',
    selectedTarget: {
      kind: 'section',
      sectionIndex: 1,
      sectionTitle: 'Contact Us',
    },
  },
];

async function main() {
  console.log('projectId:', projectId);
  console.log('OBSERVABILITY_INTENT_HARDCODE:', process.env.OBSERVABILITY_INTENT_HARDCODE ?? '(unset → fallback on null)');

  for (const scenario of scenarios) {
    const raw = await fetchObservabilityIntentRaw({
      projectId,
      body: {
        user_message: scenario.userMessage,
        selected_target: serializeSelectedTargetForMonitor(scenario.selectedTarget) ?? null,
        conversation_id: `${projectId}-editor`,
      },
    });
    const parsed = await fetchObservabilityIntent({
      projectId,
      userMessage: scenario.userMessage,
      selectedTarget: scenario.selectedTarget,
    });

    console.log('\n===', scenario.name, '===');
    console.log('user_message:', scenario.userMessage);
    console.log('RAW Monitor response:', JSON.stringify(raw, null, 2));
    console.log('la-mue parsed sentence:', parsed?.sentence ?? null);
    console.log('source:', raw?.intent ? 'Monitor POST /intent' : 'fallback or null');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
