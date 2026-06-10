import { cn } from '@/lib/cn';
import { INTRO, type IntroAccentId } from '@/content/marketingTheme';

/** Shared intro page section shell — fully transparent; mesh is on the page backdrop only. */
export function IntroSection({
  id,
  accentId,
  children,
  className,
  innerClassName,
  noPadding = false,
}: {
  id?: string;
  accentId: IntroAccentId;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /** Hero uses custom vertical padding instead of default section rhythm. */
  noPadding?: boolean;
}) {
  return (
    <section
      id={id}
      data-accent={accentId}
      className={cn(
        INTRO.section,
        !noPadding && 'scroll-mt-20 py-20 lg:py-28',
        className
      )}
    >
      <div
        className={cn(
          'relative mx-auto max-w-[980px] px-4 sm:px-6',
          innerClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
