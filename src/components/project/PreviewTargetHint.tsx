'use client';

interface Props {
  visible: boolean;
  pulse?: boolean;
  onDismiss?: () => void;
}

/** First-run hint encouraging drag-to-chat preview targeting. */
export function PreviewTargetHint({ visible, pulse = false, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <div
      className={`mb-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-700 ${
        pulse ? 'animate-pulse ring-2 ring-zinc-300/60 ring-offset-1' : ''
      }`}
      role="note"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 leading-relaxed">
          Drag a section or element here to target your edit.
        </p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            aria-label="Dismiss targeting hint"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
