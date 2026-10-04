import NextLink from 'next/link';
import {
    type ComponentProps,
    forwardRef,
    type HTMLAttributes,
    type MouseEventHandler,
    type ReactNode,
    type Ref,
} from 'react';
import { cx } from '../utils';

export type ColorPaletteProp =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

export type ChipProps = Omit<
    HTMLAttributes<HTMLElement>,
    'color' | 'onClick'
> & {
    disabled?: boolean;
    color?: ColorPaletteProp;
    variant?: 'plain' | 'outlined' | 'soft' | 'solid';
    size?: 'sm' | 'md' | 'lg';
    onClick?: MouseEventHandler<HTMLButtonElement>;
    href?: string | undefined;
    startDecorator?: ReactNode;
};

const sizeClassNames = {
    sm: 'min-h-6 px-1.5 py-0.5 text-xs',
    md: 'min-h-7 px-2 py-1 text-sm',
    lg: 'min-h-8 px-3 py-1 text-sm',
};

const decoratorSizeClassNames = {
    sm: '[&>svg]:size-3.5',
    md: '[&>svg]:size-4',
    lg: '[&>svg]:size-4',
};

const variantColorClassNames = {
    solid: {
        primary: 'bg-primary text-primary-foreground border-primary',
        secondary: 'bg-secondary text-secondary-foreground border-secondary',
        error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
        warning:
            'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
        info: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
        success:
            'bg-green-100 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
        neutral: 'bg-card text-card-foreground/80 border-border',
    },
    soft: {
        primary: 'bg-primary/10 text-primary border-transparent',
        secondary: 'bg-secondary text-secondary-foreground border-transparent',
        error: 'bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-200',
        warning:
            'bg-amber-100 text-amber-900 border-transparent dark:bg-amber-950 dark:text-amber-200',
        info: 'bg-blue-100 text-blue-900 border-transparent dark:bg-blue-950 dark:text-blue-200',
        success:
            'bg-green-100 text-green-900 border-transparent dark:bg-green-950 dark:text-green-200',
        neutral: 'bg-muted text-foreground border-transparent',
    },
    outlined: {
        primary: 'bg-transparent text-primary border-primary/40',
        secondary:
            'bg-transparent text-secondary-foreground border-secondary-foreground/30',
        error: 'bg-transparent text-red-700 border-red-300 dark:text-red-300 dark:border-red-800',
        warning:
            'bg-transparent text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800',
        info: 'bg-transparent text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-800',
        success:
            'bg-transparent text-green-700 border-green-300 dark:text-green-300 dark:border-green-800',
        neutral: 'bg-transparent text-foreground border-border',
    },
    plain: {
        primary: 'bg-transparent text-primary border-transparent',
        secondary:
            'bg-transparent text-secondary-foreground border-transparent',
        error: 'bg-transparent text-red-700 border-transparent dark:text-red-300',
        warning:
            'bg-transparent text-amber-700 border-transparent dark:text-amber-300',
        info: 'bg-transparent text-blue-700 border-transparent dark:text-blue-300',
        success:
            'bg-transparent text-green-700 border-transparent dark:text-green-300',
        neutral: 'bg-transparent text-foreground border-transparent',
    },
};

export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip(
    {
        children,
        className,
        color = 'neutral',
        disabled,
        href,
        onClick,
        size = 'md',
        startDecorator,
        title,
        variant = 'solid',
        ...rest
    },
    ref,
) {
    const content = (
        <>
            {startDecorator ? (
                <span
                    className={cx(
                        'inline-flex shrink-0 items-center justify-center [&>svg]:shrink-0',
                        decoratorSizeClassNames[size],
                    )}
                >
                    {startDecorator}
                </span>
            ) : null}
            {children}
        </>
    );
    const mergedClassName = cx(
        'm-0 inline-flex w-fit max-w-full min-w-0 shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap transition-colors',
        variantColorClassNames[variant][color],
        sizeClassNames[size],
        disabled && 'pointer-events-none opacity-50',
        (href || onClick) && !disabled && 'cursor-pointer hover:opacity-80',
        className,
    );

    if (href) {
        return (
            <NextLink
                aria-disabled={disabled}
                className={mergedClassName}
                href={href as ComponentProps<typeof NextLink>['href']}
                ref={ref as Ref<HTMLAnchorElement>}
                tabIndex={disabled ? -1 : undefined}
                title={title}
                {...rest}
            >
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
                ref={ref as Ref<HTMLButtonElement>}
                title={title}
                type="button"
                {...rest}
            >
                {content}
            </button>
        );
    }

    return (
        <span
            className={mergedClassName}
            ref={ref as Ref<HTMLSpanElement>}
            title={title}
            {...rest}
        >
            {content}
        </span>
    );
});
