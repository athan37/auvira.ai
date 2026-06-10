import { Caveat } from 'next/font/google';

/** Handwritten display face for brand wordmark loaders. */
export const brandDisplay = Caveat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-brand-display',
  display: 'swap',
});
