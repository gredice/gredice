'use client';

import { useEffect, useState } from 'react';
import { getClosingSoonHours } from './slotClosingSoon';

const REFRESH_INTERVAL_MS = 60 * 1000;

export function ClosingSoonIndicator({
    effectiveClosesAt,
}: {
    effectiveClosesAt: string;
}) {
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        const refresh = () => setNow(Date.now());
        refresh();
        const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, []);

    if (now === null) {
        return null;
    }

    const remainingHours = getClosingSoonHours({ effectiveClosesAt, now });

    if (remainingHours === null) {
        return null;
    }

    return (
        <span className="inline-flex w-full items-center gap-1 border-amber-200/70 border-t bg-amber-50/70 px-2.5 py-1 text-[0.65rem] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
            <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
            />
            <span>Uskoro se zatvara</span>
            <span aria-hidden>·</span>
            <span>još {remainingHours} h</span>
        </span>
    );
}
