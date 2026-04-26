import type { ReactNode } from 'react';
import { cx } from './cx';

export type KbdProps = {
  className?: string;
  children?: ReactNode;
};

export function Kbd({ className, children }: KbdProps) {
  return <span className={cx('kbd mono', className)}>{children}</span>;
}
