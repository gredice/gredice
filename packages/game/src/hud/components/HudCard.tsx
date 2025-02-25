"use client";

import { HTMLAttributes } from 'react'
import { cx } from '@signalco/ui-primitives/cx';
import { useSpring, animated } from "@react-spring/web";

type HudCardProps = HTMLAttributes<HTMLDivElement> & {
    open?: boolean,
    position: 'floating' | 'top' | 'bottom' | 'right' | 'left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
};

export function HudCard({ open, position, className, style, ...rest }: HudCardProps) {
    const transitions = useSpring({
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(-100%)",
        config: { duration: 150 }
    })

    return (
        /* @ts-ignore TODO: Fix when react-spring is updated for React 19 */
        <animated.div
            // @ts-ignore
            className={cx(
                "absolute md:p-1",
                'bg-background border-tertiary',
                position === 'floating' && 'rounded-full border-b-4',
                position === 'top' && 'rounded-b-xl border-b-4',
                position === 'bottom' && 'rounded-t-xl border-t-4',
                position === 'right' && 'rounded-l-xl border-l-4',
                position === 'left' && 'rounded-r-xl border-r-4',
                position === 'top-right' && 'rounded-bl-xl border-b-4',
                position === 'top-left' && 'rounded-br-xl border-b-4',
                position === 'bottom-right' && 'rounded-tl-xl border-t-4',
                position === 'bottom-left' && 'rounded-tr-xl border-t-4',
                className
            )}
            style={{
                ...transitions,
                ...style
            }}
            {...rest} />
    );
}