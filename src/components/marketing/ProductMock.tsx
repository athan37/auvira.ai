'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { useReducedMotion } from '@/components/motion';

/** Cinematic product frame with subtle float animation. */
export function ProductMock() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[640px]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.div
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={
          reduced
            ? undefined
            : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="rounded-3xl border border-[#d2d2d7]/80 bg-white p-3 shadow-product"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 rounded-t-2xl bg-[#f5f5f7] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-[#86868b]">
            firstsite.app/preview
          </span>
        </div>

        {/* Editor mock */}
        <div className="grid gap-0 overflow-hidden rounded-b-2xl border border-t-0 border-[#d2d2d7]/60 bg-[#1d1d1f] lg:grid-cols-[1fr_280px]">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-[#86868b]">Live preview</p>
                <p className="mt-1 text-sm font-semibold text-white">Northstar Dental</p>
              </div>
              <Badge tone="brand" className="!bg-brand-600/20 !text-brand-300 !border-brand-500/30">
                Preview
              </Badge>
            </div>
            <div className="mt-5 rounded-xl bg-white p-5">
              <div className="h-2.5 w-20 rounded-full bg-brand-100" />
              <div className="mt-8 h-7 w-4/5 rounded-full bg-[#1d1d1f]" />
              <div className="mt-3 h-7 w-3/5 rounded-full bg-[#86868b]" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="h-16 rounded-lg bg-brand-50 border border-brand-100" />
                <div className="h-16 rounded-lg bg-[#f5f5f7]" />
                <div className="h-16 rounded-lg bg-[#f5f5f7]" />
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 bg-[#000000]/40 p-4 lg:border-l lg:border-t-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[#86868b]">Chat</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90">
                Make the hero warmer and add financing details.
              </div>
              <div className="rounded-xl bg-brand-600/30 px-3 py-2 text-xs text-brand-100">
                Updated hero section and added financing card.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** @deprecated Use ProductMock */
export const PreviewMock = ProductMock;
