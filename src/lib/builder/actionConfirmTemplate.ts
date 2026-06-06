/** Client component for mock action confirmations (no backend). */
export function generateActionConfirmTsx(): string {
  return `'use client';

import { useState } from 'react';

export type ActionConfirmType = 'quote' | 'book' | 'buy' | 'donate' | 'rsvp' | 'contact';

const CONFIRM_MESSAGES: Record<ActionConfirmType, string> = {
  quote: "Request submitted — we'll be in touch soon.",
  book: 'Booking request received.',
  buy: "Order received — we'll confirm shortly.",
  donate: 'Thank you for supporting our cause!',
  rsvp: "You're on the list — see you there!",
  contact: 'Message sent — thanks for reaching out.',
};

interface ActionConfirmProps {
  actionType: ActionConfirmType;
  itemName: string;
  ctaLabel: string;
  className?: string;
  fieldPath?: string;
}

export function ActionConfirmButton({
  actionType,
  itemName,
  ctaLabel,
  className = '',
  fieldPath,
}: ActionConfirmProps) {
  const [open, setOpen] = useState(false);

  const attrs: Record<string, string> = {
    type: 'button',
    'data-site-element-kind': 'action_cta',
    'data-site-element-label': 'Action CTA',
  };
  if (fieldPath) {
    attrs['data-site-config-field-path'] = fieldPath;
    attrs['data-site-surface-id'] = fieldPath.replace(/[\\[\\].]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  return (
    <>
      <button
        {...attrs}
        className={className}
        onClick={() => setOpen(true)}
      >
        {ctaLabel}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmation"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{itemName}</p>
            <p className="mt-4 text-lg font-semibold text-slate-950">{CONFIRM_MESSAGES[actionType]}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
`;
}

/** Whether generated site needs ActionConfirm client component. */
export function siteConfigUsesActions(content: string): boolean {
  return /["']type["']\s*:\s*["']actions["']|type\s*:\s*['"]actions['"]/.test(content);
}
