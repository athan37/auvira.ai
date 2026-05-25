'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'site-agent-getting-started-dismissed';

export type ChecklistContext = 'dashboard' | 'editor';

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

interface Props {
  context: ChecklistContext;
  className?: string;
}

/** First-run checklist for non-technical website owners; dismissible via localStorage. */
export function OwnerGettingStartedChecklist({ context, className }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_KEY}-${context}`;
    setVisible(localStorage.getItem(key) !== '1');
  }, [context]);

  const dismiss = () => {
    localStorage.setItem(`${STORAGE_KEY}-${context}`, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const steps = STEPS[context];

  return (
    <Card className={cn('p-4 border-zinc-200 bg-white', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            {context === 'dashboard' ? 'Getting started' : 'How editing works'}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {context === 'dashboard'
              ? 'Three steps to your new website'
              : 'Your draft preview is on the left — publish when ready'}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-zinc-500 hover:text-zinc-800 shrink-0"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-zinc-800">{step.title}</p>
              <p className="text-xs text-zinc-500">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

