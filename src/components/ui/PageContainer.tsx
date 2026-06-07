import { cn } from '@/lib/cn';

export function PageContainer({
  className,
  children,
  narrow,
  hero,
}: {
  className?: string;
  children: React.ReactNode;
  narrow?: boolean;
  hero?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        hero ? 'max-w-[980px]' : narrow ? 'max-w-3xl' : 'max-w-7xl',
        className
      )}
    >
      {children}
    </div>
  );
}
