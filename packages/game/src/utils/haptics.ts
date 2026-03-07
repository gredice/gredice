const HAPTIC_STORAGE_KEY = 'hapticDisabled';

function canVibrate() {
    return (
        typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
    );
}

export function isHapticDisabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(HAPTIC_STORAGE_KEY) === 'true';
}

export function setHapticDisabled(disabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(HAPTIC_STORAGE_KEY, String(disabled));
}

function vibrate(pattern: number | number[]) {
    if (!canVibrate() || isHapticDisabled()) {
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
