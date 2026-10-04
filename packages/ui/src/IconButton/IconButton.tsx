import type { ReactNode } from 'react';
import {
    Button,
    type ButtonButtonProps,
    type ButtonLinkProps,
} from '../Button';
import { cx } from '../utils';

type IconButtonAccessibleLabel =
    | {
          'aria-label': string;
      }
    | {
          title: string;
      }
    | {
          'aria-labelledby': string;
      };

type IconButtonOwnProps = IconButtonAccessibleLabel & {
    children: ReactNode;
};

export type IconButtonButtonProps = Omit<
    ButtonButtonProps,
    'endDecorator' | 'fullWidth' | 'startDecorator'
> &
    IconButtonOwnProps;

export type IconButtonLinkProps = Omit<
    ButtonLinkProps,
    'endDecorator' | 'fullWidth' | 'startDecorator'
> &
    IconButtonOwnProps;

export type IconButtonProps = IconButtonButtonProps | IconButtonLinkProps;

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
