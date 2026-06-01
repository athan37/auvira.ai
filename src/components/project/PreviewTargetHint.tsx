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
      className={`mb-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-900 ${
        pulse ? 'animate-pulse ring-2 ring-blue-300/60 ring-offset-1' : ''
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
            className="shrink-0 text-blue-700 hover:text-blue-900"
            aria-label="Dismiss targeting hint"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
