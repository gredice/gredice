'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
    Button,
    type ButtonButtonProps,
    type ButtonColor,
    type ButtonLinkProps,
    type VariantKeys,
} from '../Button';
import { Down } from '../icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '../Menu';
import { cx } from '../utils';

type SplitButtonSize = NonNullable<ButtonButtonProps['size']>;

type SplitButtonActionProps =
    | Omit<
          ButtonButtonProps,
          | 'className'
          | 'color'
          | 'endDecorator'
          | 'fullWidth'
          | 'size'
          | 'variant'
      >
    | Omit<
          ButtonLinkProps,
          | 'className'
          | 'color'
          | 'endDecorator'
          | 'fullWidth'
          | 'size'
          | 'variant'
      >;

type SplitButtonDropdownContentProps = Omit<
    ComponentPropsWithoutRef<typeof DropdownMenuContent>,
    'children'
>;

export type SplitButtonProps = SplitButtonActionProps & {
    actionClassName?: string;
    children: ReactNode;
    className?: string;
    color?: ButtonColor;
    dropdownContentProps?: SplitButtonDropdownContentProps;
    dropdownLabel: string;
    dropdownTitle?: string;
    fullWidth?: boolean;
    menuContent: ReactNode;
    menuDisabled?: boolean;
    size?: SplitButtonSize;
    triggerClassName?: string;
    variant?: VariantKeys;
};

const triggerSizeClassNames = {
    xs: 'w-7',
    sm: 'w-8',
    md: 'w-10',
    lg: 'w-11',
} satisfies Record<SplitButtonSize, string>;

const triggerIconSizeClassNames = {
    xs: 'size-3.5',
    sm: 'size-4',
    md: 'size-4',
    lg: 'size-5',
} satisfies Record<SplitButtonSize, string>;

function splitButtonActionClassName(variant: VariantKeys) {
    return variant === 'outlined' ? 'border-r-0' : '';
}

function splitButtonTriggerClassName(variant: VariantKeys) {
    if (variant === 'outlined') {
        return 'border-l border-input';
    }

    if (variant === 'plain') {
        return 'border-l border-input';
    }

    return 'border-l border-current/20';
}

export function SplitButton({
    actionClassName,
    children,
    className,
    color,
    disabled,
    dropdownContentProps,
    dropdownLabel,
    dropdownTitle,
    fullWidth,
    loading,
    menuContent,
    menuDisabled,
    size = 'md',
    triggerClassName,
    variant = 'solid',
    ...actionProps
}: SplitButtonProps) {
    const dropdownDisabled = disabled || loading || menuDisabled;

    return (
        <div
            className={cx(
                'inline-flex shrink-0 items-stretch rounded-md',
                fullWidth && 'w-full',
                className,
            )}
        >
            <Button
                {...actionProps}
                className={cx(
                    'overflow-hidden whitespace-nowrap rounded-r-none',
                    splitButtonActionClassName(variant),
                    fullWidth && 'min-w-0 flex-1',
                    actionClassName,
                )}
                color={color}
                disabled={disabled}
                loading={loading}
                size={size}
                variant={variant}
            >
                <span className="min-w-0 truncate">{children}</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        aria-label={dropdownLabel}
                        className={cx(
                            'shrink-0 rounded-l-none px-0',
                            triggerSizeClassNames[size],
                            splitButtonTriggerClassName(variant),
                            triggerClassName,
                        )}
                        color={color}
                        disabled={dropdownDisabled}
                        size={size}
                        title={dropdownTitle ?? dropdownLabel}
                        type="button"
                        variant={variant}
                    >
                        <Down
                            aria-hidden
                            className={cx(
                                'shrink-0',
                                triggerIconSizeClassNames[size],
                            )}
                        />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" {...dropdownContentProps}>
                    {menuContent}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
