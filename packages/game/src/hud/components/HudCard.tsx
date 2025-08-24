'use client';

import { animated, useSpring } from '@react-spring/web';
import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';

type HudCardProps = HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    position:
        | 'floating'
        | 'top'
        | 'bottom'
        | 'right'
        | 'left'
        | 'top-right'
        | 'top-left'
        | 'bottom-right'
        | 'bottom-left';
    animateHeight?: boolean;
};

export function HudCard({
    open,
    position,
    className,
    style,
    animateHeight,
    ...rest
}: HudCardProps) {
    const transitions = useSpring({
        opacity: open ? 1 : 0,
        transform: open
            ? 'translateY(0)'
            : position === 'bottom' || (className?.includes('bottom-') ?? false)
              ? 'translateY(100%)'
              : 'translateY(-100%)',
        config: { duration: 150 },
    });

    return (
        <animated.div
            className={cx(
                'absolute md:p-1',
                'bg-background border-tertiary transition-all',
                animateHeight && open && 'h-auto',
                animateHeight && !open && 'h-0',
                position === 'floating' && 'rounded-full border-b-4',
                position === 'top' && 'rounded-b-xl border-b-4',
                position === 'bottom' && 'rounded-t-xl border-t-4',
                position === 'right' && 'rounded-l-xl border-l-4',
                position === 'left' && 'rounded-r-xl border-r-4',
                position === 'top-right' && 'rounded-bl-xl border-b-4',
                position === 'top-left' && 'rounded-br-xl border-b-4',
                position === 'bottom-right' && 'rounded-tl-xl border-t-4',
                position === 'bottom-left' && 'rounded-tr-xl border-t-4',
                className,
            )}
            style={{
                ...transitions,
                ...style,
            }}
            {...rest}
        />
    );
}
