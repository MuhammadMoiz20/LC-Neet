import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import { cx } from './cx';

export type GlassPanelProps<T extends ElementType = 'div'> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function GlassPanel<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...rest
}: GlassPanelProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return createElement(Tag, { className: cx('glass', className), ...rest }, children);
}
