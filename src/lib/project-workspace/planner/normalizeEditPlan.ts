/** Normalize planner JSON before Zod validation (LLM alias cleanup). */
export function normalizeEditPlanPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const plan = { ...(raw as Record<string, unknown>) };
  const targets = plan.targets;
  if (Array.isArray(targets)) {
    plan.targets = targets.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const target = { ...(entry as Record<string, unknown>) };
      if (target.kind === 'business' || target.kind === 'business-name') {
        target.kind = 'businessName';
      }
      return target;
    });
  }

  return plan;
}
