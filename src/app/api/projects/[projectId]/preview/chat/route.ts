import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectMessage } from '@/models/ProjectMessage';
import { ProjectAction } from '@/models/ProjectAction';
import { getLLMClient } from '@/lib/llm/llmClient';
import { editResultSchema, type SiteSpec } from '@/lib/agent/schemas';
import { buildApplyEditPrompt } from '@/lib/agent/prompts';

/** @deprecated Owner editing uses POST /code-agent/edit/stream (code mode only). */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  console.warn('[DEPRECATED] /preview/chat called — use /code-agent/edit/stream');
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { message, streaming } = body;
  if (!message) {
    return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 });
  }

  const projectId = project._id;
  const currentSpec = project.draftSiteSpec || project.siteSpec;
  const llmClient = getLLMClient();

  // Prompt inputs
  const promptInput = {
    system: "You are an AI website maintenance agent for a small business website. Update the site spec based on the user's edit request. Be practical - add useful sections and content, not overly verbose copy. Preserve the existing business identity, services, and contact info unless asked to change them.",
    prompt: buildApplyEditPrompt(message, currentSpec as Record<string, unknown>),
    schema: editResultSchema,
  };

  try {
    // Save user message
    await ProjectMessage.create({
      projectId,
      ownerId: project.ownerId,
      role: 'user',
      content: message,
    });

    // LLM edit — streaming or non-streaming based on client preference
    let editResult: { data: { updatedSiteSpec: SiteSpec; summaryOfChanges: string[] } };

    if (streaming && llmClient.generateJSONStream) {
      // Streaming: accumulate tokens for UX, but only apply after complete valid JSON
      const tokens: string[] = [];
      editResult = await llmClient.generateJSONStream<{ updatedSiteSpec: SiteSpec; summaryOfChanges: string[] }>(
        promptInput,
        (token) => { tokens.push(token); }
      );
    } else {
      // Non-streaming fallback
      editResult = await llmClient.generateJSON<{ updatedSiteSpec: SiteSpec; summaryOfChanges: string[] }>(promptInput);
    }

    const { updatedSiteSpec, summaryOfChanges } = editResult.data;

    // Save updated draftSiteSpec (only after complete valid JSON received)
    await WebsiteProject.updateOne({ _id: projectId }, {
      $set: {
        draftSiteSpec: updatedSiteSpec as any,
        hasUnpublishedChanges: true,
        lastPreviewEditedAt: new Date(),
      },
    });

    // Save assistant message
    await ProjectMessage.create({
      projectId,
      ownerId: project.ownerId,
      role: 'assistant',
      content: summaryOfChanges.join('\n'),
      metadata: { summaryOfChanges },
    });

    // Record action
    await ProjectAction.create({
      projectId,
      ownerId: project.ownerId,
      type: 'chat_edit',
      status: 'succeeded',
      input: { message },
      output: { summaryOfChanges },
      completedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      summaryOfChanges,
      updatedSiteSpec,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    // Record failed action
    await ProjectAction.create({
      projectId,
      ownerId: project.ownerId,
      type: 'chat_edit',
      status: 'failed',
      input: { message },
      error: errMsg,
      completedAt: new Date(),
    });

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}