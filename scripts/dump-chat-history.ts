/**
 * Dump recent project chat messages with observability metadata.
 *   node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/dump-chat-history.ts [projectId]', {stdio:'inherit'})"
 */
import mongoose from 'mongoose';
import { connectMongoDB } from '../src/lib/mongodb';
import { ProjectMessage } from '../src/models/ProjectMessage';
import { buildConversationHistory } from '../src/lib/chat/projectChatService';

const args = process.argv.slice(2);
const latestOnly = args.includes('--latest');
const projectId = args.find((a) => !a.startsWith('--')) ?? '6a26cc3deeea946b980a52da';
const limit = latestOnly ? 12 : 30;

async function main() {
  await connectMongoDB();
  const oid = new mongoose.Types.ObjectId(projectId);
  let docs = await ProjectMessage.find({ projectId: oid })
    .select('role content metadata createdAt')
    .sort({ createdAt: latestOnly ? -1 : 1 })
    .limit(limit)
    .lean();
  if (latestOnly) docs = docs.reverse();

  console.log(`Project ${projectId}: ${docs.length} messages\n`);

  for (const d of docs) {
    const m = (d.metadata ?? {}) as Record<string, unknown>;
    const obs = m.observability as Record<string, unknown> | undefined;
    console.log('---', d.role, new Date(d.createdAt).toISOString());
    console.log('content:', String(d.content).slice(0, 100));
    console.log('outcome:', m.outcome ?? '(none)');
    console.log('guidanceHints:', Array.isArray(m.guidanceHints) ? m.guidanceHints : '(none)');
    if (obs) {
      console.log('observability keys:', Object.keys(obs).join(', '));
      const intentFeed = obs.intentFeed as { turnCount?: number; keywords?: string[] } | undefined;
      const monitorContext = obs.monitorContext as { source?: string; coachingHints?: string[] } | undefined;
      const applied = obs.appliedProjectMemory as unknown[] | undefined;
      console.log('  intentFeed turnCount:', intentFeed?.turnCount);
      console.log('  monitorContext source:', monitorContext?.source);
      console.log('  coachingHints count:', monitorContext?.coachingHints?.length ?? 0);
      console.log('  appliedProjectMemory:', applied?.length ?? 0);
    } else {
      console.log('observability: (none)');
    }
  }

  const history = await buildConversationHistory({ projectId, maxTurns: 8 });
  console.log('\n=== buildConversationHistory (last 8 messages) ===');
  for (const turn of history) {
    console.log(`${turn.role}: ${turn.content.slice(0, 80)}`);
    if (turn.metadata) console.log('  metadata keys:', Object.keys(turn.metadata).join(', '));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
