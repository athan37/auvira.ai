/**
 * Call edit/stream like the UI and measure SSE timeline.
 * Requires dev server + SITE_AGENT_DEV_BYPASS_AUTH=1.
 * Usage: npx tsx scripts/measure-edit-stream-http.ts [projectId] [message]
 */

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const MESSAGE = process.argv[3] || 'change background to blue';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const url = `${BASE}/api/projects/${PROJECT_ID}/code-agent/edit/stream`;
  const t0 = Date.now();
  console.log('POST', url);
  console.log('message:', MESSAGE);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: MESSAGE, attachments: [] }),
    signal: AbortSignal.timeout(300_000),
  });

  console.log('HTTP', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text();
    console.log(text.slice(0, 500));
    process.exit(1);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');

  const decoder = new TextDecoder();
  let buffer = '';
  let doneEvent: Record<string, unknown> | null = null;
  const steps: { type: string; atMs: number; payload: unknown }[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const event = JSON.parse(raw) as Record<string, unknown>;
        steps.push({ type: String(event.type), atMs: Date.now() - t0, payload: event });
        if (event.type === 'done') {
          doneEvent = (event.result as Record<string, unknown>) || event;
        }
      } catch {
        /* skip */
      }
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log('\n--- Done ---');
  console.log({ elapsedSec: (elapsedMs / 1000).toFixed(1), result: doneEvent });

  console.log('\n--- Steps ---');
  for (const s of steps.filter((x) => x.type === 'step')) {
    const p = s.payload as { id?: string; status?: string; label?: string };
    console.log(`  ${s.atMs}ms  ${p.id}  ${p.status}  ${p.label}`);
  }

  const result = (doneEvent || {}) as { ok?: boolean; showChangesTab?: boolean; ownerMessage?: string };
  console.log('\n--- UI ---');
  console.log({
    chatSuccess: result.ok !== false,
    showChangesTab: Boolean(result.showChangesTab),
    ownerMessage: result.ownerMessage?.slice(0, 200),
  });

  process.exit(result.ok !== false ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
