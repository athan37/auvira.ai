import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

interface Props {
  target: SelectedTargetInput;
  interactive?: boolean;
  active?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onClick?: () => void;
}

function sectionLabel(target: SelectedTargetInput): string {
  if (target.kind === 'hero') return 'Hero';
  return target.sectionTitle?.trim() || target.sectionType || 'Section';
}

/** Read-only section pin shown above a user message in chat history. */
export function MessageSelectedSectionBadge({
  target,
  interactive = false,
  active = false,
  onHoverStart,
  onHoverEnd,
  onClick,
}: Props) {
  const label = sectionLabel(target);

  return (
    <div
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-blue-900 ${
        interactive
          ? active
            ? 'cursor-pointer border-blue-600 bg-blue-100 ring-2 ring-blue-400/50 shadow-sm transition-colors'
            : 'cursor-pointer border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 hover:shadow-sm transition-colors'
          : 'border-blue-200 bg-blue-50'
      }`}
      title={
        interactive
          ? `Show ${label} in preview`
          : target.sectionId
            ? `Section id: ${target.sectionId}`
            : undefined
      }
      onMouseEnter={interactive ? onHoverStart : undefined}
      onMouseLeave={interactive ? onHoverEnd : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive && onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="shrink-0 font-medium text-blue-800">Section:</span>
      <span className="truncate">{label}</span>
      {target.kind === 'section' && target.sectionType ? (
        <span className="shrink-0 text-blue-700/70">({target.sectionType})</span>
      ) : null}
    </div>
  );
}
