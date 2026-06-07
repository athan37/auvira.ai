/**
 * Probe Site Monitor GET /context — run:
 *   node --env-file=.env --import tsx scripts/probe-coaching-context.ts [projectId]
 */
import { fetchCoachingContext } from '../src/lib/observability/fetchCoachingContext';
import { fetchObservabilityContextRaw } from '../src/lib/observability/client';
import { editorConversationId } from '../src/lib/observability/conversationId';
import { isObservabilityEnabled } from '../src/lib/observability/config';

const projectId = process.argv[2] ?? '6a1f8d175872cf542bda0c54';
const conversationId = editorConversationId(projectId);

const messages = [
  'change first section to red',
  'change hero background to green',
  'make the contact section title say Hello',
  'delete the last section',
  'totally unrelated random gibberish xyz123',
];

async function probe(label: string, userMessage: string) {
  const raw = await fetchObservabilityContextRaw({
    projectId,
    conversationId,
    latestUserMessage: userMessage,
  });
  const parsed = await fetchCoachingContext({ projectId, userMessage });
  console.log('\n---', label, '---');
  console.log('userMessage:', JSON.stringify(userMessage));
  console.log('raw.context:', JSON.stringify(raw?.context ?? null, null, 2));
  console.log('parsed.coachingHints:', parsed?.coachingHints ?? null);
  console.log('parsed.source:', parsed?.source ?? null);
  console.log('parsed.recurringIssues:', parsed?.recurringIssues ?? null);
}

async function main() {
  console.log('observability enabled:', isObservabilityEnabled());
  console.log('projectId:', projectId);
  console.log('conversationId:', conversationId);

  if (!isObservabilityEnabled()) {
    console.error('OBSERVABILITY_ENABLED is off or OBSERVABILITY_API_KEY missing');
    process.exit(1);
  }

  console.log('\n=== Same message 3x (should differ only if monitor is message-aware) ===');
  for (let i = 1; i <= 3; i++) {
    await probe(`repeat ${i}/3`, messages[0]!);
  }

  console.log('\n=== Different messages ===');
  for (const msg of messages) {
    await probe('vary message', msg);
  }

  console.log('\n=== No latest_user_message param ===');
  const rawNoMsg = await fetchObservabilityContextRaw({ projectId, conversationId });
  console.log(JSON.stringify(rawNoMsg?.context ?? null, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
