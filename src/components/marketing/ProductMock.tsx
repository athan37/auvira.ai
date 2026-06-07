'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { useReducedMotion } from '@/components/motion';
import { cn } from '@/lib/cn';

type ProductMockProps = {
  variant?: 'default' | 'glass';
  /** When false, parent handles entrance animation (e.g. PromoGlassReveal). */
  animateEntrance?: boolean;
};

/** Cinematic product frame with optional glass variant for promo band. */
export function ProductMock({ variant = 'default', animateEntrance = true }: ProductMockProps) {
  const reduced = useReducedMotion();
  const isGlass = variant === 'glass';

  const shellClass = cn(
    'rounded-3xl p-3 transition-all',
    isGlass
      ? 'border border-white/25 bg-white/15 shadow-rose-glass backdrop-blur-xl'
      : 'border border-[#d2d2d7]/80 bg-white shadow-product hover:border-rose-highlight hover:shadow-rose-glass'
  );

  const chromeClass = cn(
    'flex items-center gap-2 rounded-t-2xl px-4 py-3',
    isGlass ? 'border-b border-white/10 bg-white/10' : 'bg-[#f5f5f7]'
  );

  const urlBarClass = cn(
    'ml-3 flex-1 rounded-md px-3 py-1 text-xs',
    isGlass ? 'bg-white/15 text-white/70' : 'bg-white text-[#86868b]'
  );

  const editorClass = cn(
    'grid gap-0 overflow-hidden rounded-b-2xl lg:grid-cols-[1fr_280px]',
    isGlass
      ? 'border border-t-0 border-white/10 bg-[#1d1d1f] shadow-[0_0_40px_rgba(200,62,95,0.15)] ring-1 ring-rose-500/25'
      : 'border border-t-0 border-[#d2d2d7]/60 bg-[#1d1d1f]'
  );

  const previewPanelClass = cn(
    'mt-5 rounded-xl p-5',
    isGlass ? 'border border-white/10 bg-white/12' : 'bg-white'
  );

  const inner = (
    <motion.div
      animate={reduced ? undefined : { y: [0, -6, 0] }}
      transition={
        reduced ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
      }
      className={shellClass}
    >
      {/* Browser chrome */}
      <div className={chromeClass}>
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className={urlBarClass}>firstsite.app/preview</span>
      </div>

      {/* Editor mock */}
      <div className={editorClass}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs text-[#86868b]">Live preview</p>
              <p className="mt-1 text-sm font-semibold text-white">Northstar Dental</p>
            </div>
            <Badge tone="rose" className="!bg-rose-600/20 !text-rose-100 !border-rose-400/30">
              Preview
            </Badge>
          </div>
          <div className={previewPanelClass}>
            <div
              className={cn(
                'h-2.5 w-20 rounded-full',
                isGlass ? 'bg-white/20' : 'bg-rose-100'
              )}
            />
            <div
              className={cn(
                'mt-8 h-7 w-4/5 rounded-full',
                isGlass ? 'bg-white/30' : 'bg-[#1d1d1f]'
              )}
            />
            <div
              className={cn(
                'mt-3 h-7 w-3/5 rounded-full',
                isGlass ? 'bg-white/20' : 'bg-[#86868b]'
              )}
            />
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div
                className={cn(
                  'h-16 rounded-lg',
                  isGlass ? 'border border-white/20 bg-white/15' : 'border border-rose-200 bg-rose-50'
                )}
              />
              <div
                className={cn('h-16 rounded-lg', isGlass ? 'bg-white/15' : 'bg-[#f5f5f7]')}
              />
              <div
                className={cn('h-16 rounded-lg', isGlass ? 'bg-white/15' : 'bg-[#f5f5f7]')}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-[#000000]/40 p-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[#86868b]">Chat</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90">
              Make the hero warmer and add financing details.
            </div>
            <div className="rounded-xl bg-rose-600/30 px-3 py-2 text-xs text-rose-100">
              Updated hero section and added financing card.
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (!animateEntrance) {
    return <div className="relative mx-auto w-full max-w-[640px]">{inner}</div>;
  }

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[640px]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {inner}
    </motion.div>
  );
}

/** @deprecated Use ProductMock */
export const PreviewMock = ProductMock;
