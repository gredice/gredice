'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useState } from 'react';

const HOUR_MS = 60 * 60 * 1000;

function formatCountdown(closeAtMs: number, nowMs: number) {
    const remainingMs = closeAtMs - nowMs;
    const absoluteMs = Math.abs(remainingMs);

    if (remainingMs > 0) {
        if (remainingMs < HOUR_MS) {
            return 'Još < 1 h';
        }

        return `Još ${Math.ceil(remainingMs / HOUR_MS).toLocaleString('hr-HR')} h`;
    }

    if (absoluteMs < HOUR_MS) {
        return 'Isteklo prije < 1 h';
    }

    return `Isteklo prije ${Math.ceil(absoluteMs / HOUR_MS).toLocaleString('hr-HR')} h`;
}

export function SlotClosingCountdown({
    closeAt,
    sourceLabel,
}: {
    closeAt: string;
    sourceLabel: string;
}) {
    const [nowMs, setNowMs] = useState<number | null>(null);
    const closeAtMs = new Date(closeAt).getTime();
    const countdownLabel =
        nowMs == null || Number.isNaN(closeAtMs)
            ? null
            : formatCountdown(closeAtMs, nowMs);

    useEffect(() => {
        const updateNow = () => setNowMs(Date.now());
        updateNow();

        const intervalId = window.setInterval(updateNow, 60_000);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <div className="min-w-36 whitespace-nowrap">
            <Typography
                level="body2"
                component="div"
                semiBold
                className="tabular-nums"
            >
                <LocalDateTime>{closeAt}</LocalDateTime>
            </Typography>
            <Typography
                level="body3"
                component="div"
                className="tabular-nums text-muted-foreground"
            >
                {countdownLabel
                    ? `${countdownLabel} - ${sourceLabel}`
                    : sourceLabel}
            </Typography>
        </div>
    );
}
