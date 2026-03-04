function canVibrate() {
    return (
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
    );
}

function vibrate(pattern: number | number[]) {
    if (!canVibrate()) {
        return;
    }

    navigator.vibrate(pattern);
}

export function triggerPickHaptic() {
    vibrate(20);
}

export function triggerPlaceHaptic() {
    vibrate([12, 20, 28]);
}

export function triggerSelectionHaptic() {
    vibrate(16);
}
