import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type ButtonGroupSize = 'xs' | 'sm' | 'md' | 'lg';

export type ButtonGroupProps = Omit<
    FieldsetHTMLAttributes<HTMLFieldSetElement>,
    'children'
> & {
    children: ReactNode;
    legend: string;
    size?: ButtonGroupSize;
};

const buttonGroupSizeClassNames = {
    xs: 'h-7',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-11',
} satisfies Record<ButtonGroupSize, string>;

const buttonGroupItemSizeClassNames = {
    xs: 'h-full min-w-7 px-2 text-xs',
    sm: 'h-full min-w-8 px-2 text-xs',
    md: 'h-full min-w-10 px-3',
    lg: 'h-full min-w-11 px-4 text-base',
} satisfies Record<ButtonGroupSize, string>;

const buttonGroupIconItemSizeClassNames = {
    xs: 'size-[calc(1.75rem-2px)] px-0',
    sm: 'size-[calc(2rem-2px)] px-0',
    md: 'size-[calc(2.5rem-2px)] px-0',
    lg: 'size-[calc(2.75rem-2px)] px-0',
} satisfies Record<ButtonGroupSize, string>;

export function ButtonGroup({
    children,
    className,
    legend,
    size = 'sm',
    ...props
}: ButtonGroupProps) {
    return (
        <fieldset
            className={cx(
                'inline-flex shrink-0 items-center gap-0 rounded-md border border-input bg-background p-px',
                buttonGroupSizeClassNames[size],
                className,
            )}
            {...props}
        >
            <legend className="sr-only">{legend}</legend>
            {children}
        </fieldset>
    );
}

export function buttonGroupItemClassName({
    className,
    iconOnly,
    size = 'sm',
}: {
    className?: string;
    iconOnly?: boolean;
    size?: ButtonGroupSize;
} = {}) {
    return cx(
        'rounded-sm',
        iconOnly
            ? buttonGroupIconItemSizeClassNames[size]
            : buttonGroupItemSizeClassNames[size],
        className,
    );
}
