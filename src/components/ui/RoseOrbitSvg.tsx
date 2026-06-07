'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { LOADING } from '@/content/productTheme';

const OUTER_SPIN_S = 1.05;
const INNER_SPIN_S = 1.75;

function strokeForSize(size: number): { outer: number; inner: number; track: number } {
  if (size <= 24) return { outer: 1.25, inner: 1, track: 1 };
  if (size <= 48) return { outer: 1.75, inner: 1.35, track: 1.15 };
  if (size <= 80) return { outer: 2.1, inner: 1.6, track: 1.25 };
  return { outer: 2.35, inner: 1.85, track: 1.35 };
}

/** Dual-ring SVG loader — co-rotating thin arcs, tick bezel, and breathing core. */
export function RoseOrbitSvg({
  size = 128,
  reduced = false,
  className,
}: {
  size?: number;
  reduced?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const glowId = `${gradientId}-glow`;
  const center = size / 2;
  const { outer: outerStroke, inner: innerStroke, track: trackStroke } = strokeForSize(size);
  const outerRadius = center - outerStroke - 2;
  const innerRadius = outerRadius - outerStroke * 2.4;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const primaryArc = outerCircumference * 0.68;
  const secondaryArc = innerCircumference * 0.52;
  const coreRadius = size <= 24 ? 2.25 : size <= 48 ? 3.5 : size <= 80 ? 4.5 : 5.5;
  const tickCount = size <= 48 ? 8 : 12;
  const tickRadius = outerRadius + outerStroke + (size <= 48 ? 2 : 3);

  const origin = `${center}px ${center}px`;
  const spinTransition = (duration: number) =>
    reduced
      ? { duration: 0 }
      : { duration, repeat: Infinity, ease: 'linear' as const };

  const outerTipAngle = -90 + (primaryArc / outerCircumference) * 360;
  const innerTipAngle = 120 + (secondaryArc / innerCircumference) * 360;

  const tipDot = (radius: number, angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      cx: center + radius * Math.cos(rad),
      cy: center + radius * Math.sin(rad),
      r,
    };
  };

  const outerTip = tipDot(outerRadius, outerTipAngle, size <= 48 ? 1.75 : 2.25);
  const innerTip = tipDot(innerRadius, innerTipAngle, size <= 48 ? 1.35 : 1.75);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F08FA0" />
          <stop offset="45%" stopColor="#E85672" />
          <stop offset="100%" stopColor="#BD365E" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E85672" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#E85672" stopOpacity={0} />
        </radialGradient>
      </defs>

      <circle
        cx={center}
        cy={center}
        r={outerRadius + outerStroke * 1.6}
        fill={`url(#${glowId})`}
      />

      {Array.from({ length: tickCount }, (_, index) => {
        const angle = (index / tickCount) * Math.PI * 2 - Math.PI / 2;
        const tickLen = size <= 48 ? 2.5 : 3.5;
        const innerR = tickRadius - tickLen;
        return (
          <line
            key={index}
            x1={center + innerR * Math.cos(angle)}
            y1={center + innerR * Math.sin(angle)}
            x2={center + tickRadius * Math.cos(angle)}
            y2={center + tickRadius * Math.sin(angle)}
            stroke="#d2d2d7"
            strokeOpacity={0.55}
            strokeWidth={size <= 48 ? 0.75 : 1}
            strokeLinecap="round"
          />
        );
      })}

      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill="none"
        stroke="#d2d2d7"
        strokeOpacity={0.35}
        strokeWidth={trackStroke}
      />

      <circle
        cx={center}
        cy={center}
        r={innerRadius}
        fill="none"
        stroke="#d2d2d7"
        strokeOpacity={0.22}
        strokeWidth={trackStroke * 0.85}
        strokeDasharray={size <= 48 ? '2 5' : '3 7'}
      />

      <motion.g
        animate={{ rotate: reduced ? 30 : 360 }}
        transition={spinTransition(OUTER_SPIN_S)}
        style={{ transformOrigin: origin, transformBox: 'fill-box' }}
      >
        <circle
          className={LOADING.ringPrimary}
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={outerStroke}
          strokeLinecap="round"
          strokeDasharray={`${primaryArc} ${outerCircumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <circle
          cx={outerTip.cx}
          cy={outerTip.cy}
          r={outerTip.r}
          fill="#E85672"
        />
      </motion.g>

      <motion.g
        animate={{ rotate: reduced ? 75 : 360 }}
        transition={spinTransition(INNER_SPIN_S)}
        style={{ transformOrigin: origin, transformBox: 'fill-box' }}
      >
        <circle
          className={LOADING.ringSecondary}
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke="#DD8399"
          strokeOpacity={0.92}
          strokeWidth={innerStroke}
          strokeLinecap="round"
          strokeDasharray={`${secondaryArc} ${innerCircumference}`}
          transform={`rotate(120 ${center} ${center})`}
        />
        <circle
          cx={innerTip.cx}
          cy={innerTip.cy}
          r={innerTip.r}
          fill="#DD8399"
          opacity={0.9}
        />
      </motion.g>

      <circle
        cx={center}
        cy={center}
        r={coreRadius + 2.5}
        fill="none"
        stroke="#E85672"
        strokeOpacity={0.18}
        strokeWidth={size <= 48 ? 0.75 : 1}
      />

      <circle
        className={cn(LOADING.ringCore, reduced && LOADING.ringCoreReduced)}
        cx={center}
        cy={center}
        r={coreRadius}
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
