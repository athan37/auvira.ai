import type { EditStep } from '@/lib/project-workspace/planner/editPlan.schema';
import {
  executeDomainTool,
  paramsForSkill,
  skillToDomainTool,
} from '@/lib/project-workspace/tools/domain/registry';
import type { DomainToolContext } from '@/lib/project-workspace/tools/domain/types';
import type {
  VerificationCheck,
  VerificationCheckKind,
} from '@/lib/project-workspace/edit-context/types';
import { runRestrictedCustomCodeEdit } from './restrictedFallback';

const CHECKS_BY_SKILL: Partial<Record<string, VerificationCheckKind[]>> = {
  update_section_style: ['section_background', 'generic'],
  update_contact: ['contact_field', 'generic'],
  update_hero: ['hero_field', 'generic'],
  update_business_name: ['business_name', 'generic'],
  update_section_copy: ['copy_field', 'generic'],
  update_config_field: ['copy_field', 'generic'],
  update_section_item_copy: ['copy_field', 'generic'],
  update_cta_label: ['copy_field', 'generic'],
};

function verificationChecksForStep(
  skill: string,
  checks: VerificationCheck[]
): VerificationCheck[] {
  const allowed = CHECKS_BY_SKILL[skill] ?? ['generic'];
  const filtered = checks.filter((c) => allowed.includes(c.kind));
  return filtered.length > 0 ? filtered : [{ kind: 'generic' }];
}

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
  toolCtx: DomainToolContext,
  options?: { deferInvariantVerify?: boolean }
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
      '@/lib/project-workspace/edit-shared/strategyContext'
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

  if (!options?.deferInvariantVerify) {
    const verifyCtx: DomainToolContext = {
      ...toolCtx,
      editContext: {
        ...toolCtx.editContext,
        verificationContract: {
          checks: verificationChecksForStep(
            step.skill,
            toolCtx.editContext.verificationContract.checks
          ),
        },
      },
    };
    const verify = await executeDomainTool('verify_source_invariants', verifyCtx, {});
    if (!verify.ok) {
      return {
        ok: false,
        skill: step.skill,
        changedFiles: toolCtx.changedFiles,
        error: verify.invariantErrors?.join('; ') ?? 'Verification failed',
      };
    }
  }

  return {
    ok: true,
    skill: step.skill,
    summary: result.summary,
    changedFiles: result.changedFiles,
  };
}
