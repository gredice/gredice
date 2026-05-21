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
    h1: 'text-5xl leading-tight font-semibold',
    h2: 'text-4xl leading-tight font-semibold',
    h3: 'text-3xl leading-tight font-semibold',
    h4: 'text-2xl leading-snug font-semibold',
    h5: 'text-xl leading-snug font-semibold',
    h6: 'text-lg leading-snug font-semibold',
    body1: 'text-base leading-7',
    body2: 'text-sm leading-6',
    body3: 'text-xs leading-5',
};

const defaultComponents = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    body1: 'p',
    body2: 'p',
    body3: 'p',
} satisfies Record<
    NonNullable<TypographyProps['level']>,
    NonNullable<TypographyProps['component']>
>;

const colorClassNames = {
    success: 'text-green-700 dark:text-green-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400',
    neutral: 'text-muted-foreground',
    info: 'text-blue-700 dark:text-blue-400',
} satisfies Record<ColorVariants, string>;

export function Typography({
    level = 'body1',
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
    const Component = component ?? defaultComponents[level];

    return (
        <Component
            className={cx(
                levelClassNames[level],
                semiBold && 'font-semibold',
                bold && 'font-bold',
                extraThin && 'font-extralight',
                thin && 'font-light',
                uppercase && 'uppercase',
                secondary && 'text-muted-foreground',
                tertiary && 'text-tertiary-foreground',
                color && colorClassNames[color],
                noWrap && 'truncate',
                gutterBottom && 'mb-2',
                center && 'text-center',
                mono && 'font-mono',
                className,
            )}
            {...rest}
        />
    );
}
