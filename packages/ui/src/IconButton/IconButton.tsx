import type { ReactNode } from 'react';
import { Button, type ButtonButtonProps } from '../Button';
import { cx } from '../utils';

export type IconButtonProps = Omit<
    ButtonButtonProps,
    'endDecorator' | 'fullWidth' | 'startDecorator'
> &
    (
        | {
              'aria-label': string;
          }
        | {
              title: string;
          }
        | {
              'aria-labelledby': string;
          }
    ) & {
        children: ReactNode;
    };

export function IconButton({
    children,
    className,
    size = 'md',
    variant = 'plain',
    ...rest
}: IconButtonProps) {
    return (
        <Button
            className={cx('aspect-square px-0', className)}
            size={size}
            variant={variant}
            {...rest}
        >
            {children}
        </Button>
    );
}
