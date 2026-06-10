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
  promo = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  inverted?: boolean;
  promo?: boolean;
}) {
  const isAnchor = href.startsWith('#');
  const classes = cn(
    'text-[17px] font-normal transition-colors',
    promo
      ? 'text-white/90 hover:text-rose-50 hover:underline underline-offset-4'
      : inverted
        ? 'text-white/90 hover:text-white hover:underline underline-offset-4'
        : 'text-blue-600 hover:text-blue-500 hover:underline underline-offset-4',
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
