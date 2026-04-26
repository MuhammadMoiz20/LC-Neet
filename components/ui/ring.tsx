import type { ReactNode } from 'react';

export type RingProps = {
  size?: number;
  stroke?: number;
  value: number;
  max: number;
  color?: string;
  track?: string;
  children?: ReactNode;
};

export function Ring({
  size = 28,
  stroke = 3,
  value,
  max,
  color = 'var(--accent)',
  track = 'var(--border)',
  children,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 400ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children && <span style={{ position: 'absolute' }}>{children}</span>}
    </span>
  );
}
