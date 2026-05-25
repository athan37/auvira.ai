import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient } from '@/lib/llm/llmClient';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { system, prompt, schema, functions } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const client = getLLMClient();
    const result = await client.generateJSON({
      system,
      prompt,
      schema,
      functions,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}