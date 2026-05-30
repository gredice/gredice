let suppressedUntil = 0;

function now() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function suppressBlockInteractions(durationMs: number) {
    suppressedUntil = Math.max(suppressedUntil, now() + durationMs);
}

export function areBlockInteractionsSuppressed() {
    return now() <= suppressedUntil;
}
