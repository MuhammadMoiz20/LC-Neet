import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './icon';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  size?: number;
  sm?: boolean;
  title: string;
};

export function IconButton({
  icon,
  size = 16,
  sm,
  title,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      className={cx('btn btn-ghost btn-icon', sm && 'btn-sm', className)}
      title={title}
      aria-label={title}
      type={type}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
