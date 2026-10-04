const HOUR_MS = 60 * 60 * 1000;
const CLOSING_SOON_WINDOW_MS = 48 * HOUR_MS;

export function getClosingSoonHours({
    effectiveClosesAt,
    now,
}: {
    effectiveClosesAt: string;
    now: number;
}) {
    const closesAt = new Date(effectiveClosesAt).getTime();

    if (Number.isNaN(closesAt)) {
        return null;
    }

    const remainingMs = closesAt - now;

    if (remainingMs <= 0 || remainingMs > CLOSING_SOON_WINDOW_MS) {
        return null;
    }

    return Math.ceil(remainingMs / HOUR_MS);
}
