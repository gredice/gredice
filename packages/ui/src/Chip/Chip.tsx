import NextLink from 'next/link';
import type { MouseEventHandler, PropsWithChildren, ReactNode } from 'react';
import { cx } from '../utils';

export type ColorPaletteProp =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

export type ChipProps = PropsWithChildren<{
    disabled?: boolean;
    color?: ColorPaletteProp;
    variant?: 'plain' | 'outlined' | 'soft' | 'solid';
    size?: 'sm' | 'md' | 'lg';
    onClick?: MouseEventHandler<HTMLButtonElement>;
    href?: string | undefined;
    startDecorator?: ReactNode;
    className?: string;
    title?: string;
}>;

const colorClassNames = {
    primary: 'bg-primary text-primary-foreground border-primary',
    secondary: 'bg-secondary text-secondary-foreground border-secondary',
    error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
    warning:
        'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
    info: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
    success:
        'bg-green-100 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
    neutral: 'bg-muted text-muted-foreground border-border',
};

const sizeClassNames = {
    sm: 'min-h-6 px-2 text-xs',
    md: 'min-h-7 px-2.5 text-sm',
    lg: 'min-h-8 px-3 text-sm',
};

export function Chip({
    children,
    className,
    color = 'neutral',
    disabled,
    href,
    onClick,
    size = 'md',
    startDecorator,
    title,
}: ChipProps) {
    const content = (
        <>
            {startDecorator}
            {children}
        </>
    );
    const mergedClassName = cx(
        'inline-flex min-w-0 items-center gap-1 rounded-full border font-medium transition-colors',
        colorClassNames[color],
        sizeClassNames[size],
        disabled && 'pointer-events-none opacity-50',
        (href || onClick) && 'cursor-pointer hover:opacity-80',
        className,
    );

    if (href) {
        return (
            <NextLink className={mergedClassName} href={href} title={title}>
                {content}
            </NextLink>
        );
    }

    if (onClick) {
        return (
            <button
                className={mergedClassName}
                disabled={disabled}
                onClick={onClick}
                title={title}
                type="button"
            >
                {content}
            </button>
        );
    }

    return (
        <span className={mergedClassName} title={title}>
            {content}
        </span>
    );
}
