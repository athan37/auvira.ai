import type { EditStep } from '@/lib/project-workspace/planner/editPlan.schema';
import {
  executeDomainTool,
  paramsForSkill,
  skillToDomainTool,
} from '@/lib/project-workspace/tools/domain/registry';
import type { DomainToolContext } from '@/lib/project-workspace/tools/domain/types';
import { runRestrictedCustomCodeEdit } from './restrictedFallback';

export interface ExecuteStepResult {
  ok: boolean;
  skill: string;
  summary?: string;
  changedFiles: string[];
  error?: string;
}

/**
 * Execute a single plan step via domain tools or restricted fallback.
 */
export async function executeStep(
  step: EditStep,
  toolCtx: DomainToolContext
): Promise<ExecuteStepResult> {
  if (step.skill === 'custom_code_edit') {
    const verify = async () => {
      const result = await executeDomainTool('verify_source_invariants', toolCtx, {});
      return result.ok;
    };
    const fallback = await runRestrictedCustomCodeEdit(
      toolCtx.editContext,
      toolCtx.editContext.ownerMessage,
      verify
    );
    for (const f of fallback.changedFiles) {
      if (!toolCtx.changedFiles.includes(f)) toolCtx.changedFiles.push(f);
    }
    return {
      ok: fallback.ok,
      skill: step.skill,
      summary: fallback.summary,
      changedFiles: fallback.changedFiles,
      error: fallback.error,
    };
  }

  if (step.skill === 'remove_section' || step.skill === 'reorder_sections') {
    return {
      ok: false,
      skill: step.skill,
      changedFiles: [],
      error: `${step.skill} is not implemented in V3 yet`,
    };
  }

  const domainTool = skillToDomainTool(step.skill);
  if (!domainTool) {
    return {
      ok: false,
      skill: step.skill,
      changedFiles: [],
      error: `No domain tool for skill ${step.skill}`,
    };
  }

  const params = paramsForSkill(
    step.skill,
    step.target as Record<string, unknown> | undefined,
    step.params as Record<string, unknown> | undefined,
    toolCtx.editContext
  );

  const result = await executeDomainTool(domainTool, toolCtx, params);

  for (const f of result.changedFiles) {
    if (!toolCtx.changedFiles.includes(f)) toolCtx.changedFiles.push(f);
  }

  if (result.ok && result.changedFiles.length > 0) {
    const { readWorkspaceRel } = await import(
      '@/lib/project-workspace/website-edit-agent/strategyContext'
    );
    for (const rel of result.changedFiles) {
      const fresh = await readWorkspaceRel(toolCtx.agentOptions, rel);
      if (fresh) toolCtx.afterFiles[rel] = fresh;
    }
    if (result.evidence?.backgroundClass && toolCtx.editContext.verificationContract.checks.length) {
      for (const check of toolCtx.editContext.verificationContract.checks) {
        if (check.kind === 'section_background') {
          check.expectedValue = result.evidence.backgroundClass;
        }
      }
    }
  }

  if (!result.ok) {
    return {
      ok: false,
      skill: step.skill,
      changedFiles: result.changedFiles,
      error: result.invariantErrors?.join('; ') ?? 'Domain tool failed',
    };
  }

  const verify = await executeDomainTool('verify_source_invariants', toolCtx, {});
  if (!verify.ok) {
    return {
      ok: false,
      skill: step.skill,
      changedFiles: toolCtx.changedFiles,
      error: verify.invariantErrors?.join('; ') ?? 'Verification failed',
    };
  }

  return {
    ok: true,
    skill: step.skill,
    summary: result.summary,
    changedFiles: result.changedFiles,
  };
}
