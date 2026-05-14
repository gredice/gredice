'use client';

import { animated, useSpring } from '@react-spring/web';
import { cx } from '@signalco/ui-primitives/cx';
import { type HTMLAttributes, useMemo } from 'react';

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
    const atBottom = useMemo(() => {
        return (
            position === 'bottom' || (className?.includes('bottom-') ?? false)
        );
    }, [position, className]);
    const opacity = useMemo(() => (open ? 1 : 0), [open]);
    const transform = useMemo(() => {
        if (open) return 'translateY(0)';
        if (atBottom) return 'translateY(100%)';
        return 'translateY(-100%)';
    }, [open, atBottom]);
    const config = useMemo(() => ({ duration: 150 }), []);

    const transitions = useSpring({
        opacity,
        transform,
        config,
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
