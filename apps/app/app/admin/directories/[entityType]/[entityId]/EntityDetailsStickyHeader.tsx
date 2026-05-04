'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export type EntityDetailsStickyHeaderProps = {
    tabs: ReactNode;
};

export function EntityDetailsStickyHeader({
    tabs,
}: EntityDetailsStickyHeaderProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsStuck(!entry.isIntersecting);
            },
            {
                rootMargin: '-8px 0px 0px 0px',
                threshold: 0,
            },
        );

        observer.observe(sentinel);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <>
            <div aria-hidden className="h-px" ref={sentinelRef} />
            <div
                className={cx(
                    'mb-2 sticky top-16 md:top-0 z-20 transition-all duration-200',
                    isStuck &&
                        'rounded-2xl border bg-background/90 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80',
                )}
            >
                <div className="min-w-0 overflow-x-auto">{tabs}</div>
            </div>
        </>
    );
}
