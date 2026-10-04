import type { AutomationRunStatus } from '@gredice/storage';

export type AutomationRunDurationInput = {
    status: AutomationRunStatus;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    lockedAt?: string | null;
    updatedAt?: string | null;
};

export type AutomationRunDurationTiming = {
    label: string;
    value: string;
};

function dateTimeMs(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const timeMs = new Date(value).getTime();

    return Number.isNaN(timeMs) ? null : timeMs;
}

export function automationRunDurationIsLive(status: AutomationRunStatus) {
    return status === 'queued' || status === 'running' || status === 'retrying';
}

export function formatAutomationRunDuration(durationMs: number) {
    const safeDurationMs = Math.max(0, Math.trunc(durationMs));

    if (safeDurationMs < 1000) {
        return `${safeDurationMs} ms`;
    }

    const totalSeconds = Math.floor(safeDurationMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);

    if (days > 0) {
        return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
    }

    if (hours > 0) {
        return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    }

    if (minutes > 0) {
        return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
    }

    return `${seconds} s`;
}

function elapsedTiming(
    label: string,
    startAt: string | null | undefined,
    nowMs: number | null,
): AutomationRunDurationTiming {
    const startAtMs = dateTimeMs(startAt);

    if (startAtMs == null || nowMs == null) {
        return { label, value: '-' };
    }

    return {
        label,
        value: formatAutomationRunDuration(nowMs - startAtMs),
    };
}

function completedTiming({
    completedAt,
    createdAt,
    startedAt,
}: AutomationRunDurationInput): AutomationRunDurationTiming {
    const completedAtMs = dateTimeMs(completedAt);
    const startedAtMs = dateTimeMs(startedAt) ?? dateTimeMs(createdAt);

    if (startedAtMs == null || completedAtMs == null) {
        return { label: 'Trajalo', value: '-' };
    }

    return {
        label: 'Trajalo',
        value: formatAutomationRunDuration(completedAtMs - startedAtMs),
    };
}

export function automationRunDurationTiming(
    run: AutomationRunDurationInput,
    nowMs: number | null,
): AutomationRunDurationTiming {
    switch (run.status) {
        case 'queued':
            return elapsedTiming('U redu', run.createdAt, nowMs);
        case 'running':
            return elapsedTiming(
                'Izvodi se',
                run.startedAt ?? run.lockedAt ?? run.updatedAt ?? run.createdAt,
                nowMs,
            );
        case 'retrying':
            return elapsedTiming(
                'Čeka ponavljanje',
                run.updatedAt ?? run.createdAt,
                nowMs,
            );
        case 'succeeded':
        case 'skipped':
        case 'failed':
        case 'canceled':
            return completedTiming(run);
    }
}
