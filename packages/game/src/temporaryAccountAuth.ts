export const temporaryAccountLoginRequestedEvent =
    'gredice:temporary-account-login-requested';

export function requestTemporaryAccountLogin() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(temporaryAccountLoginRequestedEvent));
}
