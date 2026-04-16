'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export type EntityDetailsStickyHeaderProps = {
    breadcrumbs: ReactNode;
    tabs: ReactNode;
    actions: ReactNode;
};

export function EntityDetailsStickyHeader({
    breadcrumbs,
    tabs,
    actions,
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
                    'sticky top-2 z-20 transition-all duration-200',
                    isStuck &&
                        'rounded-2xl border border-muted/40 bg-background/90 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80',
                )}
            >
                <div className="flex flex-row items-center justify-between gap-2">
                    <div className="min-w-0">{breadcrumbs}</div>
                    <div className="min-w-0 flex-1 overflow-x-auto">{tabs}</div>
                    <div className="shrink-0">{actions}</div>
                </div>
            </div>
        </>
    );
}
