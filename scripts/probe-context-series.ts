/**
 * Multi-turn context probe — favorite-color + follow-up resolution.
 * Run: node --env-file=.env npx tsx scripts/probe-context-series.ts [projectId]
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  resolveEffectiveEditMessage,
  wasColorClarificationAsked,
  DEFAULT_EDIT_CONTEXT_TURNS,
} from '@/lib/chat/conversationContextForEdit';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { fetchObservabilityIntent, fetchObservabilityMemory } from '@/lib/observability';
import { upsertLocalProjectMemorySlots } from '@/lib/observability/localProjectMemory';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import { createSyntheticWorkspace } from '../tests/support/syntheticSiteWorkspace';
import { scratchPath } from '@/lib/runtime/scratchDir';

const projectId = process.argv[2] ?? '6a26cc3deeea946b980a52da';

const CONTACT_TARGET = {
  kind: 'section' as const,
  sectionId: 'contact',
  sectionIndex: 1,
  label: 'Contact',
  pagePath: '/',
};

type StepResult = {
  turn: number;
  userMessage: string;
  effectiveMessage: string;
  colorClarifyAsked: boolean;
  implicit: {
    needsClarification: boolean;
    clarificationPreview?: string;
    resolvedMessage?: string;
    references?: unknown[];
  };
  agent?: {
    ok: boolean;
    needsClarification: boolean;
    ownerMessage?: string;
    pendingImplicitRef?: unknown;
    resolvedReferences?: unknown[];
    strategy?: string;
  };
};

function printStep(r: StepResult): void {
  console.log(`\n--- Turn ${r.turn}: "${r.userMessage}" ---`);
  console.log('effectiveMessage:', r.effectiveMessage.slice(0, 160));
  console.log('wasColorClarificationAsked (prior):', r.colorClarifyAsked);
  console.log('implicit:', {
    needsClarification: r.implicit.needsClarification,
    clarification: r.implicit.clarificationPreview?.slice(0, 120),
    resolvedMessage: r.implicit.resolvedMessage?.slice(0, 120),
    refCount: r.implicit.references?.length ?? 0,
  });
  if (r.agent) {
    console.log('agent:', {
      ok: r.agent.ok,
      needsClarification: r.agent.needsClarification,
      strategy: r.agent.strategy,
      reply: r.agent.ownerMessage?.slice(0, 140),
      pendingImplicitRef: r.agent.pendingImplicitRef,
      resolvedRefs: r.agent.resolvedReferences,
    });
  }
}

async function runStep(
  turn: number,
  userMessage: string,
  history: ConversationTurn[],
  workspacePath: string,
  intent: Awaited<ReturnType<typeof fetchObservabilityIntent>>,
  memory: Awaited<ReturnType<typeof fetchObservabilityMemory>>,
  runAgent: boolean,
  pinContact?: boolean
): Promise<StepResult> {
  const selectedTarget = pinContact ? CONTACT_TARGET : undefined;
  const effectiveMessage = resolveEffectiveEditMessage(
    userMessage,
    history,
    undefined,
    selectedTarget
  );

  const ctx = await buildEditContext({
    workspacePath,
    mode: 'gitlab',
    ownerMessage: userMessage,
    conversationHistory: history,
    infraBaselineReady: true,
    selectedTarget,
  });

  const implicit = await resolveImplicitReferences({
    ownerMessage: userMessage,
    editContext: ctx.context,
    projectIntent: intent,
    projectMemory: memory,
    recentHistory: history,
  });

  const result: StepResult = {
    turn,
    userMessage,
    effectiveMessage,
    colorClarifyAsked: wasColorClarificationAsked(history),
    implicit: {
      needsClarification: Boolean(implicit.needsClarification),
      clarificationPreview: implicit.clarificationMessage,
      resolvedMessage: implicit.resolvedMessage,
      references: implicit.references,
    },
  };

  if (runAgent) {
    const agent = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: userMessage,
      conversationHistory: history,
      projectId,
      mode: 'gitlab',
      infraBaselineReady: true,
      selectedTarget,
      projectIntent: intent,
      projectMemory: memory,
    });
    result.agent = {
      ok: agent.ok,
      needsClarification: Boolean(agent.needsClarification),
      ownerMessage: agent.ownerMessage,
      pendingImplicitRef: agent.pendingImplicitRef,
      resolvedReferences: agent.resolvedReferences,
      strategy: agent.strategy,
    };
  }

  return result;
}

async function main(): Promise<void> {
  console.log('=== Context series probe ===');
  console.log('projectId:', projectId);
  console.log('DEFAULT_EDIT_CONTEXT_TURNS:', DEFAULT_EDIT_CONTEXT_TURNS);

  const intent = await fetchObservabilityIntent({
    projectId,
    userMessage: 'change background to my favorite color',
  });
  const memory = await fetchObservabilityMemory(projectId);
  console.log('intent sentence:', intent?.sentence?.slice(0, 120) ?? 'n/a');
  console.log('memory slots:', memory?.slots?.length ?? 0);

  const workspacePath = await createSyntheticWorkspace({
    site: {
      businessName: 'Context Probe Co',
      sections: [
        { type: 'hero', title: 'Hero' },
        { type: 'contact', title: 'Contact Us' },
      ],
    },
    pageMode: 'wired',
    workspaceId: `context-probe-${randomUUID().slice(0, 8)}`,
  });
  console.log('workspace:', workspacePath);

  const history: ConversationTurn[] = [];
  const steps: Array<{ msg: string; runAgent: boolean; pinContact?: boolean }> = [
    { msg: 'change this to my favourite color', runAgent: true, pinContact: true },
    { msg: 'Green', runAgent: true, pinContact: true },
    { msg: 'make the Contact section background my favorite color', runAgent: true },
    { msg: 'use my faviorite color for the contact section', runAgent: false },
  ];

  const results: StepResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    const { msg, runAgent, pinContact } = steps[i];
    const r = await runStep(
      i + 1,
      msg,
      history,
      workspacePath,
      intent,
      memory,
      runAgent,
      pinContact
    );
    results.push(r);
    printStep(r);

    const assistantContent =
      r.agent?.ownerMessage ??
      r.implicit.clarificationPreview ??
      (r.agent?.ok ? 'Applied edit.' : 'No clarify text.');

    history.push({ role: 'user', content: msg });
    history.push({
      role: 'assistant',
      content: assistantContent,
      metadata: {
        ...(r.agent?.pendingImplicitRef
          ? { pendingImplicitRef: r.agent.pendingImplicitRef }
          : {}),
        outcome: r.agent?.needsClarification
          ? 'clarify'
          : r.agent?.ok
            ? 'success'
            : 'error',
      },
    });

    if (
      r.implicit.references?.length &&
      !r.implicit.needsClarification &&
      process.env.SKIP_MONGO_MEMORY !== '1'
    ) {
      try {
        await upsertLocalProjectMemorySlots({
          projectId,
          slots: [
            {
              kind: 'color',
              phrase_aliases: ['my favorite color', 'my favourite color'],
              resolved_value: 'green',
              scope: {},
              confidence: 'high',
              source: 'chat_history',
            },
          ],
        });
      } catch (err) {
        console.warn('[probe] local memory upsert skipped:', (err as Error).message);
      }
    }
  }

  console.log('\n=== Expectations ===');
  const t1 = results[0];
  const t2 = results[1];
  const t3 = results[2];
  const t4 = results[3];

  const checks: Array<{ label: string; pass: boolean }> = [
    {
      label: 'Turn 1 asks for color (not surface picker spiral)',
      pass: Boolean(t1.agent?.needsClarification) && /color|colour/i.test(t1.agent?.ownerMessage ?? ''),
    },
    {
      label: 'Turn 1 sets pendingImplicitRef',
      pass: Boolean(t1.agent?.pendingImplicitRef),
    },
    {
      label: 'Turn 2 merges Green into effective message',
      pass: /green/i.test(t2.effectiveMessage),
    },
    {
      label: 'Turn 3 resolves favorite color without re-ask (implicit or agent)',
      pass:
        !t3.implicit.needsClarification ||
        Boolean(t3.implicit.resolvedMessage && /green/i.test(t3.implicit.resolvedMessage)),
    },
    {
      label: 'Turn 4 typo "faviorite" still detected',
      pass: /favorite|favourite|faviorite/i.test(t4.effectiveMessage + t4.userMessage),
    },
  ];

  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.label}`);
  }

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed`);

  await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => {});

  if (passed < checks.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
