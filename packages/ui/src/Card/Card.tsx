'use client';

import { slugify } from '@gredice/js/slug';
import {
    forwardRef,
    type HTMLAttributes,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import { Divider } from '../Divider';
import { Row, type RowProps } from '../Row';
import { Stack } from '../Stack';
import { cx } from '../utils';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
    href?: string;
    variant?: 'default' | 'secondary';
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
    { className, href, onClick, onKeyDown, variant, ...props },
    ref,
) {
    const interactive = Boolean(href || onClick);
    const cardClassName = cx(
        'rounded-lg border bg-card p-2 text-card-foreground shadow-xs',
        interactive &&
            'cursor-default hover:bg-accent hover:text-accent-foreground',
        variant === 'secondary' && 'bg-card/60',
        className,
    );

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        if (onClick) {
            onClick(event);
            return;
        }

        if (href) {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = href;
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        onKeyDown?.(event);

        if (
            event.defaultPrevented ||
            (event.key !== 'Enter' && (!onClick || event.key !== ' '))
        ) {
            return;
        }

        event.preventDefault();

        if (onClick) {
            event.currentTarget.click();
            return;
        }

        if (href) {
            window.location.href = href;
        }
    }

    if (!interactive) {
        return <div className={cardClassName} ref={ref} {...props} />;
    }

    if (onClick) {
        return (
            // biome-ignore lint/a11y/useSemanticElements: Preserve Signalco's div-based Card API for compatibility.
            <div
                className={cardClassName}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                ref={ref}
                role="button"
                tabIndex={props.tabIndex ?? 0}
                {...props}
            />
        );
    }

    return (
        // biome-ignore lint/a11y/useSemanticElements: Preserve Signalco's div-based Card href behavior for compatibility.
        <div
            className={cardClassName}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            ref={ref}
            role="link"
            tabIndex={props.tabIndex ?? 0}
            {...props}
        />
    );
});

export function CardHeader({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx('flex flex-col space-y-1.5 p-2 pt-1', className)}
            {...props}
        />
    );
}

export function CardTitle({
    children,
    className,
    id,
    ...props
}: HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={cx('text-2xl font-semibold tracking-tight', className)}
            id={
                id ??
                (typeof children === 'string' ? slugify(children) : undefined)
            }
            {...props}
        >
            {children}
        </h3>
    );
}

export function CardOverflow({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cx('-m-2', className)} {...props} />;
}

export type CardContentProps = HTMLAttributes<HTMLDivElement> & {
    noHeader?: boolean;
};

export function CardContent({
    className,
    noHeader,
    ...props
}: CardContentProps) {
    return (
        <div className={cx('p-2', !noHeader && 'pt-0', className)} {...props} />
    );
}

export function CardCover({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={className} {...props} />;
}

export function CardActions({ children, className, ...rest }: RowProps) {
    return (
        <Stack className="-mx-4" spacing={4}>
            <Divider />
            <Row className={cx('px-4 pb-0', className)} spacing={4} {...rest}>
                {children}
            </Row>
        </Stack>
    );
}
