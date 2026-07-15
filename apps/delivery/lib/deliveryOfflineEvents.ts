export const deliveryLogoutEvent = 'gredice:delivery:logout';
export const deliveryLogoutCompletedEvent = 'gredice:delivery:logout-completed';
export const deliveryLogoutFailedEvent = 'gredice:delivery:logout-failed';
export const deliveryRunCompletedEvent = 'gredice:delivery:run-completed';

const deliverySessionChannelName = 'gredice:delivery:session';
const deliveryLogoutStorageKey = 'gredice:delivery:logout-signal';

type DeliveryLogoutSignal = {
    version: 1;
    kind: 'logout' | 'logout-completed' | 'logout-failed';
    id: string;
};

function isDeliveryLogoutSignal(value: unknown): value is DeliveryLogoutSignal {
    return (
        typeof value === 'object' &&
        value !== null &&
        'version' in value &&
        value.version === 1 &&
        'kind' in value &&
        (value.kind === 'logout' ||
            value.kind === 'logout-completed' ||
            value.kind === 'logout-failed') &&
        'id' in value &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        value.id.length <= 256
    );
}

function logoutSignal(
    kind: DeliveryLogoutSignal['kind'],
    id?: string,
): DeliveryLogoutSignal {
    return {
        version: 1,
        kind,
        id:
            id ??
            globalThis.crypto?.randomUUID?.() ??
            `logout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
}

function localEventForSignal(kind: DeliveryLogoutSignal['kind']) {
    switch (kind) {
        case 'logout':
            return deliveryLogoutEvent;
        case 'logout-completed':
            return deliveryLogoutCompletedEvent;
        case 'logout-failed':
            return deliveryLogoutFailedEvent;
    }
}

function publishDeliverySessionSignal(signal: DeliveryLogoutSignal) {
    window.dispatchEvent(new Event(localEventForSignal(signal.kind)));
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel(deliverySessionChannelName);
            channel.postMessage(signal);
            channel.close();
        }
    } catch {
        // The storage signal remains available when channel creation is blocked.
    }
    try {
        window.localStorage.setItem(
            deliveryLogoutStorageKey,
            JSON.stringify(signal),
        );
        window.localStorage.removeItem(deliveryLogoutStorageKey);
    } catch {
        // BroadcastChannel still propagates the signal when storage is blocked.
    }
}

export function publishDeliveryLogout() {
    const signal = logoutSignal('logout');
    publishDeliverySessionSignal(signal);
    return signal.id;
}

export function publishDeliveryLogoutCompleted(id: string) {
    publishDeliverySessionSignal(logoutSignal('logout-completed', id));
}

export function publishDeliveryLogoutFailed(id: string) {
    publishDeliverySessionSignal(logoutSignal('logout-failed', id));
}

export function subscribeToRemoteDeliveryLogout({
    onLogout,
    onCompleted,
    onFailed,
}: {
    onLogout: () => void;
    onCompleted: () => void;
    onFailed: () => void;
}) {
    let lastSignalKey: string | null = null;
    const receive = (value: unknown) => {
        if (!isDeliveryLogoutSignal(value)) return;
        const signalKey = `${value.kind}:${value.id}`;
        if (signalKey === lastSignalKey) return;
        lastSignalKey = signalKey;
        if (value.kind === 'logout') onLogout();
        else if (value.kind === 'logout-completed') onCompleted();
        else onFailed();
    };
    let channel: BroadcastChannel | null = null;
    try {
        channel =
            typeof BroadcastChannel === 'undefined'
                ? null
                : new BroadcastChannel(deliverySessionChannelName);
    } catch {
        // The storage event remains available when channels are blocked.
    }
    const handleChannelMessage = (event: MessageEvent<unknown>) =>
        receive(event.data);
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== deliveryLogoutStorageKey || !event.newValue) return;
        try {
            receive(JSON.parse(event.newValue));
        } catch {
            // Ignore malformed cross-tab signals.
        }
    };
    channel?.addEventListener('message', handleChannelMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
        channel?.removeEventListener('message', handleChannelMessage);
        channel?.close();
        window.removeEventListener('storage', handleStorage);
    };
}
