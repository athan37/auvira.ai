'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'site-agent-getting-started-dismissed';

export type ChecklistContext = 'dashboard' | 'editor';
export type ChecklistVariant = 'card' | 'compact';

const STEPS = {
  dashboard: [
    { title: 'Create a website', detail: 'Clone your existing site from a URL, or start from a template.' },
    { title: 'Review the plan', detail: 'We read your site and suggest a layout — you approve before we build.' },
    { title: 'Publish when ready', detail: 'Chat to edit, then publish your live site with one click.' },
  ],
  editor: [
    { title: 'Wait for your draft preview', detail: 'The left panel loads a local preview — usually 1–3 minutes.' },
    { title: 'Describe changes in chat', detail: 'Try “Change the headline” or “Add an FAQ section”.' },
    { title: 'Publish live', detail: 'When you’re happy, use Publish live site to update your public URL.' },
  ],
} as const;

const SUBTITLES = {
  dashboard: 'Three steps to your new website',
  editor: 'Your draft preview is on the left — publish when ready',
} as const;

const TITLES = {
  dashboard: 'Getting started',
  editor: 'How editing works',
} as const;

interface Props {
  context: ChecklistContext;
  className?: string;
  /** `compact` = collapsible button (editor sidebar). `card` = full panel (dashboard). */
  variant?: ChecklistVariant;
}

function StepList({ context }: { context: ChecklistContext }) {
  const steps = STEPS[context];
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-2.5 text-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
            {i + 1}
          </span>
          <div>
            <p className="font-medium text-zinc-800 text-xs leading-snug">{step.title}</p>
            <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** First-run checklist for non-technical website owners; dismissible via localStorage. */
export function OwnerGettingStartedChecklist({ context, className, variant = 'card' }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_KEY}-${context}`;
    setVisible(localStorage.getItem(key) !== '1');
  }, [context]);

  const dismiss = () => {
    localStorage.setItem(`${STORAGE_KEY}-${context}`, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const title = TITLES[context];
  const subtitle = SUBTITLES[context];

  if (variant === 'compact') {
    return (
      <div className={cn('shrink-0 border-t border-zinc-200/80 bg-white', className)}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
        >
          <span className="text-xs font-medium text-zinc-700">{title}</span>
          <span className="text-[10px] text-zinc-400 shrink-0" aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
        {expanded && (
          <div className="px-3 pb-3 pt-0 border-t border-zinc-100">
            <div className="flex items-start justify-between gap-2 mb-2 pt-2">
              <p className="text-[11px] text-zinc-500 leading-snug">{subtitle}</p>
              <button
                type="button"
                onClick={dismiss}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 shrink-0"
              >
                Dismiss
              </button>
            </div>
            <StepList context={context} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('p-4 border-zinc-200 bg-white', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-zinc-500 hover:text-zinc-800 shrink-0"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3">
        <StepList context={context} />
      </div>
    </Card>
  );
}
