let suppressedUntil = 0;
let holdCount = 0;

function now() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function suppressBlockInteractions(durationMs: number) {
    suppressedUntil = Math.max(suppressedUntil, now() + durationMs);
}

/**
 * Suppresses block interactions until the returned function runs, e.g.
 * while Expand owns canvas taps (D6): a tap that sets its corner must not
 * also open a garden box or toggle a gate under it. Each hold is released
 * once; repeated calls of the same release do nothing.
 */
export function holdBlockInteractions() {
    holdCount += 1;
    let held = true;
    return () => {
        if (held) {
            held = false;
            holdCount -= 1;
        }
    };
}

export function areBlockInteractionsSuppressed() {
    return holdCount > 0 || now() <= suppressedUntil;
}
