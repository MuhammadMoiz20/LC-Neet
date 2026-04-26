import type { ReactNode } from 'react';
import { cx } from './cx';

export type PillKind = 'easy' | 'med' | 'hard' | 'accent' | 'info';

export type PillProps = {
  kind?: PillKind;
  className?: string;
  children?: ReactNode;
};

export function Pill({ kind, className, children }: PillProps) {
  return <span className={cx('pill', kind && `pill-${kind}`, className)}>{children}</span>;
}
