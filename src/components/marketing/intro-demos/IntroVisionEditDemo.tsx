'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import {
  INTRO_DEMO_DRAG_LABEL,
  INTRO_DEMO_VISION_EDIT_REPLY,
  INTRO_DEMO_VISION_VOICE_EDIT,
} from '@/content/marketing';
import { useReducedMotion, APPLE_EASE } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';
import { useTypewriter } from './useTypewriter';

type Mode = 'drag' | 'voice';
type DragPhase = 'idle' | 'dragging' | 'dropped';

const WAVEFORM_BARS = [0.35, 0.7, 0.5, 0.9, 0.45] as const;

/** Vision section: drag to pin a target, then voice an edit after the site is built. */
export function IntroVisionEditDemo() {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [mode, setMode] = useState<Mode>(reduced ? 'voice' : 'drag');
  const [dragPhase, setDragPhase] = useState<DragPhase>(reduced ? 'dropped' : 'idle');
  const [voiceDone, setVoiceDone] = useState(reduced);

  const voiceVisible = useTypewriter({
    text: INTRO_DEMO_VISION_VOICE_EDIT,
    active: active && mode === 'voice' && !voiceDone,
    reduced: reduced || voiceDone,
    loop: false,
    holdMs: 1200,
    typeDelay: 38,
  });

  useEffect(() => {
    if (reduced || !active) return;

    if (mode === 'drag') {
      if (dragPhase === 'idle') {
        const t = setTimeout(() => setDragPhase('dragging'), 900);
        return () => clearTimeout(t);
      }
      if (dragPhase === 'dragging') {
        const t = setTimeout(() => setDragPhase('dropped'), 1500);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setMode('voice');
        setDragPhase('idle');
        setVoiceDone(false);
      }, 2600);
      return () => clearTimeout(t);
    }

    if (mode === 'voice' && voiceDone) {
      const t = setTimeout(() => {
        setMode('drag');
        setDragPhase('idle');
        setVoiceDone(false);
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [active, dragPhase, mode, reduced, voiceDone]);

  useEffect(() => {
    if (reduced || !active || mode !== 'voice') return;
    if (voiceVisible.length !== INTRO_DEMO_VISION_VOICE_EDIT.length) return;

    const t = setTimeout(() => setVoiceDone(true), 1200);
    return () => clearTimeout(t);
  }, [active, mode, reduced, voiceVisible.length]);

  useEffect(() => {
    if (!active && !reduced) {
      setMode('drag');
      setDragPhase('idle');
      setVoiceDone(false);
    }
  }, [active, reduced]);

  const showDragGhost = mode === 'drag' && dragPhase === 'dragging' && !reduced;
  const showPinned = mode === 'drag' && (dragPhase === 'dropped' || reduced);
  const showReply =
    (mode === 'drag' && dragPhase === 'dropped') || (mode === 'voice' && voiceDone) || reduced;
  const showVoiceUi = mode === 'voice' && !reduced && !voiceDone;

  return (
    <div ref={ref} className="relative">
      <IntroDemoFrame
        label="Animation: after your site is built, edit by dragging a section into chat or speaking your change"
        className="overflow-hidden"
        header={
          <div className="mb-4 space-y-3 border-b border-[#d2d2d7]/60 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-800" aria-hidden />
                <span className="text-xs font-medium text-[#86868b]">Refine your live site</span>
              </div>
            </div>
            <div className="flex gap-2">
              {(['drag', 'voice'] as const).map((m) => (
                <span
                  key={m}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    mode === m
                      ? m === 'drag'
                        ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/60'
                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/60'
                      : 'bg-[#f5f5f7] text-[#86868b]'
                  )}
                >
                  {m === 'drag' ? 'Drag' : 'Voice'}
                </span>
              ))}
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
          <div className="rounded-xl border border-[#d2d2d7]/60 bg-[#1d1d1f] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#86868b]">Live preview</p>
            <div
              className={cn(
                'mt-2 rounded-lg border-2 border-dashed p-3 transition-colors',
                mode === 'drag' && (dragPhase === 'idle' || reduced)
                  ? 'border-rose-400/60 bg-rose-50/10'
                  : 'border-transparent bg-white/5'
              )}
            >
              <div className="h-2 w-16 rounded-full bg-white/25" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-white/40" />
              <div className="mt-2 h-2 w-3/5 rounded-full bg-white/20" />
            </div>
          </div>

          <div className="rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#86868b]">Chat</p>
            <div
              className={cn(
                'mt-2 min-h-[5.5rem] rounded-lg border-2 border-dashed px-2 py-2 transition-colors',
                mode === 'drag' && dragPhase === 'dragging' && !reduced
                  ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/40'
                  : mode === 'voice' && !reduced
                    ? 'border-blue-300/60 bg-blue-50/30'
                    : 'border-[#d2d2d7]/80 bg-white'
              )}
            >
              <AnimatePresence mode="wait">
                {showVoiceUi ? (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white',
                          active && 'animate-pulse'
                        )}
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                        </svg>
                      </span>
                      <div className="flex flex-1 items-end justify-center gap-0.5 h-6">
                        {WAVEFORM_BARS.map((h, i) => (
                          <motion.span
                            key={i}
                            className="w-0.5 rounded-full bg-rose-500/70"
                            animate={
                              active
                                ? {
                                    height: [`${h * 40}%`, `${(1 - h) * 50 + 20}%`, `${h * 40}%`],
                                  }
                                : { height: `${h * 40}%` }
                            }
                            transition={{
                              duration: 0.55,
                              repeat: active ? Infinity : 0,
                              delay: i * 0.08,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] leading-snug text-[#1d1d1f]">
                      &ldquo;{voiceVisible}
                      <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-rose-500 align-middle" />
                      &rdquo;
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {showPinned && (
                      <div className="mb-2 inline-flex max-w-full items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 ring-1 ring-rose-200/60">
                        <span className="truncate">{INTRO_DEMO_DRAG_LABEL}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-[#86868b]">
                      {mode === 'drag' && dragPhase === 'dragging' && !reduced
                        ? 'Drop to pin target…'
                        : mode === 'voice' && voiceDone
                          ? 'Voice captured'
                          : 'Describe your change…'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showReply && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 rounded-lg bg-blue-50/90 px-2 py-1.5 text-[10px] leading-snug text-[#1d1d1f]"
                  >
                    {INTRO_DEMO_VISION_EDIT_REPLY}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </IntroDemoFrame>

      <AnimatePresence>
        {showDragGhost && (
          <motion.div
            className="pointer-events-none absolute z-10 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1d1d1f] shadow-lg ring-2 ring-rose-400/50"
            initial={{ left: '12%', top: '48%', opacity: 0, scale: 0.9 }}
            animate={{ left: '58%', top: '72%', opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 1.2, ease: APPLE_EASE }}
          >
            {INTRO_DEMO_DRAG_LABEL}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
