'use client';

import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useState } from 'react';

const hudListItemTransitionMs = 300;

export function HudListItemPresence({
    children,
    className,
    visible,
}: {
    children: ReactNode;
    className?: string;
    visible: boolean;
}) {
    const [isPresent, setIsPresent] = useState(visible);
    const [isEntered, setIsEntered] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsPresent(true);
            const frameId = window.requestAnimationFrame(() => {
                setIsEntered(true);
            });
            return () => window.cancelAnimationFrame(frameId);
        }

        setIsEntered(false);
        if (!isPresent) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setIsPresent(false);
        }, hudListItemTransitionMs);
        return () => window.clearTimeout(timeoutId);
    }, [isPresent, visible]);

    if (!isPresent) {
        return null;
    }

    const isInteractive = visible && isEntered;

    return (
        <div
            aria-hidden={!isInteractive}
            data-hud-list-item-presence={
                isInteractive ? 'visible' : 'transitioning'
            }
            inert={isInteractive ? undefined : true}
            className={cx(
                'grid origin-top transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-out motion-reduce:transition-none',
                isEntered
                    ? 'mt-0 grid-rows-[1fr] translate-x-0 opacity-100'
                    : '-mt-2 grid-rows-[0fr] -translate-x-4 opacity-0',
                className,
            )}
        >
            <div className="min-h-0 overflow-visible">{children}</div>
        </div>
    );
}
