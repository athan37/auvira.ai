import { cn } from '@/lib/cn';

/** Eyebrow + section title pattern for marketing sections. */
export function SectionEyebrow({
  eyebrow,
  title,
  description,
  className,
  align = 'left',
  inverted = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  align?: 'left' | 'center';
  inverted?: boolean;
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className
      )}
    >
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.08em]',
          inverted ? 'text-[#86868b]' : 'text-[#6e6e73]'
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl',
          inverted ? 'text-white' : 'text-[#1d1d1f]'
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'mt-4 text-[17px] leading-[1.47]',
            inverted ? 'text-[#a1a1a6]' : 'text-[#6e6e73]'
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
