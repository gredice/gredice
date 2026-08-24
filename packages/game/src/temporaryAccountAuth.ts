import { getBrowserGrediceAppOrigin } from '@gredice/client';

export const temporaryAccountLoginRequestedEvent =
    'gredice:temporary-account-login-requested';
export const temporaryAccountLoginOpenChangedEvent =
    'gredice:temporary-account-login-open-changed';

export type TemporaryAccountLoginOpenChangedDetail = {
    open: boolean;
};

let temporaryAccountLoginOpen = false;

export function isTemporaryAccountLoginOpen() {
    return temporaryAccountLoginOpen;
}

export function notifyTemporaryAccountLoginOpenChanged(open: boolean) {
    temporaryAccountLoginOpen = open;

    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<TemporaryAccountLoginOpenChangedDetail>(
            temporaryAccountLoginOpenChangedEvent,
            { detail: { open } },
        ),
    );
}

export function getTemporaryAccountLoginUrl(gardenOrigin: string) {
    const loginUrl = new URL(gardenOrigin);
    loginUrl.searchParams.set('prijava', '1');
    return loginUrl.toString();
}

export function requestTemporaryAccountLogin() {
    if (typeof window === 'undefined') {
        return;
    }

    const handledInCurrentApp = !window.dispatchEvent(
        new CustomEvent(temporaryAccountLoginRequestedEvent, {
            cancelable: true,
        }),
    );
    if (handledInCurrentApp) {
        return;
    }

    window.location.assign(
        getTemporaryAccountLoginUrl(getBrowserGrediceAppOrigin('garden')),
    );
}
