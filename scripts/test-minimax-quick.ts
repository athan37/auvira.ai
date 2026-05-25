/**
 * Quick smoke test for direct MiniMax API (loads .env via node --env-file).
 * Usage: node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/test-minimax-quick.ts
 */

import { getLLMClient } from '../src/lib/llm/llmClient';

async function main() {
  const provider = process.env.LLM_PROVIDER || 'minimax';
  console.log('LLM_PROVIDER:', provider);
  console.log('MINIMAX_API_URL:', process.env.MINIMAX_API_URL || '(default)');
  console.log('MINIMAX_MODEL:', process.env.MINIMAX_MODEL || '(default)');
  console.log('MINIMAX_API_KEY:', process.env.MINIMAX_API_KEY ? 'set' : 'MISSING');
  console.log('');

  if (!process.env.MINIMAX_API_KEY && provider !== 'minimax-proxy') {
    console.error('MINIMAX_API_KEY is not set');
    process.exit(1);
  }

  const client = getLLMClient();
  const started = Date.now();

  const result = await client.generateJSON<{ msg: string; provider: string }>({
    system: 'You are a test assistant. Respond with JSON only.',
    prompt: 'Say hello and confirm the LLM integration works.',
    schema: {
      type: 'object',
      required: ['msg', 'provider'],
      properties: {
        msg: { type: 'string' },
        provider: { type: 'string' },
      },
    },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
