import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type ColorVariants =
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'info';

export type TypographyProps = HTMLAttributes<HTMLParagraphElement> & {
    level?:
        | 'h1'
        | 'h2'
        | 'h3'
        | 'h4'
        | 'h5'
        | 'h6'
        | 'body1'
        | 'body2'
        | 'body3';
    component?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
    semiBold?: boolean;
    bold?: boolean;
    extraThin?: boolean;
    thin?: boolean;
    uppercase?: boolean;
    secondary?: boolean;
    tertiary?: boolean;
    noWrap?: boolean;
    color?: ColorVariants;
    gutterBottom?: boolean;
    center?: boolean;
    mono?: boolean;
    children?: ReactNode;
};

const levelClassNames = {
    h1: 'text-5xl text-balance',
    h2: 'text-4xl text-balance',
    h3: 'text-3xl text-balance',
    h4: 'text-2xl text-balance',
    h5: 'text-xl text-balance',
    h6: 'text-lg text-balance',
    body1: 'text-base text-primary',
    body2: 'text-sm text-secondary-foreground',
    body3: 'text-xs text-tertiary-foreground',
};

const colorClassNames = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    neutral: 'text-slate-500',
    info: 'text-blue-500',
} satisfies Record<ColorVariants, string>;

function defaultComponent(
    level: TypographyProps['level'],
): NonNullable<TypographyProps['component']> {
    switch (level) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            return level;
        default:
            return 'p';
    }
}

export function Typography({
    level,
    component,
    className,
    semiBold,
    bold,
    extraThin,
    thin,
    uppercase,
    secondary,
    tertiary,
    noWrap,
    color,
    gutterBottom,
    center,
    mono,
    ...rest
}: TypographyProps) {
    const Component = component ?? defaultComponent(level);

    return (
        <Component
            className={cx(
                'm-0',
                level && levelClassNames[level],
                semiBold && 'font-medium',
                bold && 'font-bold',
                extraThin && 'font-thin',
                thin && 'font-light',
                uppercase && 'uppercase',
                secondary && 'text-secondary-foreground',
                tertiary && 'text-tertiary-foreground',
                color && colorClassNames[color],
                noWrap && 'overflow-x-hidden text-ellipsis whitespace-nowrap',
                gutterBottom && 'mb-2',
                center && 'text-center',
                mono && 'font-mono',
                className,
            )}
            {...rest}
        />
    );
}
