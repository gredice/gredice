"use client";

import { HTMLAttributes } from 'react'
import { cx } from '@signalco/ui-primitives/cx';
import { useSpring, animated } from "@react-spring/web";

type HudCardProps = HTMLAttributes<HTMLDivElement> & {
    open?: boolean,
    position: 'top' | 'bottom' | 'right' | 'left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
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
            className={cx(
                "absolute bg-background shadow-md",
                position === 'top' && 'rounded-b-xl',
                position === 'bottom' && 'rounded-t-xl',
                position === 'right' && 'rounded-l-xl',
                position === 'left' && 'rounded-r-xl',
                position === 'top-right' && 'rounded-bl-xl',
                position === 'top-left' && 'rounded-br-xl',
                position === 'bottom-right' && 'rounded-tl-xl',
                position === 'bottom-left' && 'rounded-tr-xl',
                className
            )}
            style={{
                ...transitions,
                ...style
            }}
            {...rest} />
    );
}