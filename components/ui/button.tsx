import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './icon';

export type ButtonKind = 'default' | 'primary' | 'ghost';
export type ButtonSize = 'sm' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: IconName;
};

export function Button({
  kind = 'default',
  size,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = cx(
    'btn',
    kind === 'primary' && 'btn-primary',
    kind === 'ghost' && 'btn-ghost',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    className,
  );
  return (
    <button className={cls} type={type} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}
