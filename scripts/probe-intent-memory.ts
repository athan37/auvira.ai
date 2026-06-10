/**
 * Probe Site Monitor POST /intent and resolver — run:
 *   node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/probe-intent-memory.ts [projectId]', {stdio:'inherit'})"
 */
import { fetchObservabilityIntent, isObservabilityEnabled, observabilityApiKey } from '../src/lib/observability';
import { resolveImplicitReferences } from '../src/lib/project-workspace/edit-context/implicitReferenceResolver';
import { intentFlowEditContext } from '../tests/support/intentUserRequestFixtures';

const projectId = process.argv[2] ?? '6a26cc3deeea946b980a52da';

async function main() {
  console.log('observability enabled:', isObservabilityEnabled());
  console.log('api key configured:', Boolean(observabilityApiKey()));
  console.log('projectId:', projectId);

  const ownerMessage = 'make the contact section background my favorite color';
  const intent = await fetchObservabilityIntent({
    projectId,
    userMessage: ownerMessage,
    selectedTarget: {
      kind: 'section',
      sectionIndex: 1,
      sectionTitle: 'Contact Us',
    },
  });
  console.log('\n=== POST /intent ===');
  console.log(JSON.stringify(intent, null, 2));

  const resolution = await resolveImplicitReferences({
    ownerMessage,
    editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
    projectIntent: intent,
  });
  console.log('\n=== Resolver (favorite color, no history) ===');
  console.log(JSON.stringify(resolution, null, 2));

  const withHistory = await resolveImplicitReferences({
    ownerMessage,
    editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
    projectIntent: intent,
    recentHistory: [
      { role: 'user', content: 'change background my favorite color' },
      { role: 'assistant', content: 'What color should I use?' },
      { role: 'user', content: 'Green' },
      { role: 'assistant', content: 'Saved. Preview is still syncing; refresh in a moment.' },
    ],
  });
  console.log('\n=== Resolver (after user picked Green in chat) ===');
  console.log(JSON.stringify(withHistory, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
