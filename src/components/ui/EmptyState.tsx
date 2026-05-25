import { cn } from '@/lib/cn';

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
      <h3 className="text-lg font-medium text-zinc-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">{description}</p>}
      {action}
    </div>
  );
}
