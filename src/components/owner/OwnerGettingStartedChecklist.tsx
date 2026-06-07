'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { BORDER, TEXT } from '@/content/productTheme';

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
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold text-white">
            {i + 1}
          </span>
          <div>
            <p className={cn('font-medium text-xs leading-snug', TEXT.primary)}>{step.title}</p>
            <p className={cn('text-[11px] leading-snug mt-0.5', TEXT.muted)}>{step.detail}</p>
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
      <div className={cn('shrink-0 border-t bg-white', BORDER.hairline, className)}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f5f5f7]'
          )}
        >
          <span className={cn('text-xs font-medium', TEXT.primary)}>{title}</span>
          <span className={cn('text-[10px] shrink-0', TEXT.tertiary)} aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
        {expanded && (
          <div className={cn('px-3 pb-3 pt-0 border-t', BORDER.hairline)}>
            <div className="flex items-start justify-between gap-2 mb-2 pt-2">
              <p className={cn('text-[11px] leading-snug', TEXT.muted)}>{subtitle}</p>
              <button
                type="button"
                onClick={dismiss}
                className={cn('text-[10px] shrink-0', TEXT.tertiary, 'hover:text-[#1d1d1f]')}
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
    <Card variant="glass" className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={cn('text-sm font-semibold', TEXT.primary)}>{title}</h2>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className={cn('text-xs shrink-0', TEXT.muted, 'hover:text-[#1d1d1f]')}
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
