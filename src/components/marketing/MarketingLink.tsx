import Link from 'next/link';
import { cn } from '@/lib/cn';
import { buttonClassName, type ButtonSize, type ButtonVariant } from '@/components/ui/buttonStyles';

/** Apple-style marketing link button. */
export function MarketingLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const isAnchor = href.startsWith('#');

  const classes = buttonClassName({ variant, size, className });

  if (isAnchor) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Text link for secondary CTAs in feature sections. */
export function MarketingTextLink({
  href,
  children,
  className,
  inverted = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  inverted?: boolean;
}) {
  const isAnchor = href.startsWith('#');
  const classes = cn(
    'text-[17px] font-normal transition-colors',
    inverted
      ? 'text-brand-400 hover:text-brand-300 hover:underline underline-offset-4'
      : 'text-brand-600 hover:underline underline-offset-4',
    className
  );

  if (isAnchor) {
    return (
      <a href={href} className={classes}>
        {children} &rsaquo;
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children} &rsaquo;
    </Link>
  );
}
