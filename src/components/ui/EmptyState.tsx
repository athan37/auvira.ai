import { cn } from '@/lib/cn';
import { TEXT } from '@/content/productTheme';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-center py-12 px-6', className)}>
      <h3 className={cn('text-lg font-medium mb-1', TEXT.primary)}>{title}</h3>
      {description && (
        <p className={cn('text-sm mb-6 max-w-md mx-auto', TEXT.muted)}>{description}</p>
      )}
      {action}
    </div>
  );
}
