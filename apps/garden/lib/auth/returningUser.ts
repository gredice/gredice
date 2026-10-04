export const returningUserStorageKey = 'gredice:returning-user:v1';

export function markReturningUser() {
    try {
        window.localStorage.setItem(returningUserStorageKey, '1');
    } catch {
        // Storage can be unavailable in private browsing or restricted contexts.
    }
}

export function hasReturningUserMarker() {
    try {
        return window.localStorage.getItem(returningUserStorageKey) === '1';
    } catch {
        return false;
    }
}
