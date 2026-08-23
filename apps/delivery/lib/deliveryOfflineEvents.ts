export const deliveryLogoutEvent = 'gredice:delivery:logout';
export const deliveryLogoutCompletedEvent = 'gredice:delivery:logout-completed';
export const deliveryLogoutFailedEvent = 'gredice:delivery:logout-failed';
export const deliveryRunCompletedEvent = 'gredice:delivery:run-completed';
export const deliverySessionResumedEvent = 'gredice:delivery:session-resumed';

const deliverySessionChannelName = 'gredice:delivery:session';
const deliveryLogoutStorageKey = 'gredice:delivery:logout-signal';
const deliveryLogoutWriteGuardKey = 'gredice:delivery:logout-write-guard';
const deliverySessionGenerationKey = 'gredice:delivery:session-generation';
let activeDeliveryLogoutId: string | null = null;
let documentDeliverySessionGeneration: string | null = null;
let sharedDeliverySessionGeneration: string | null = null;

type DeliveryLogoutSignal = {
    version: 1;
    kind: 'logout' | 'logout-completed' | 'logout-failed' | 'session-resumed';
    id: string;
};

function deliverySessionStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function deliverySessionStorageValue(key: string) {
    try {
        return deliverySessionStorage()?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

documentDeliverySessionGeneration = deliverySessionStorageValue(
    deliverySessionGenerationKey,
);
sharedDeliverySessionGeneration = documentDeliverySessionGeneration;

export function blockDeliveryOfflineWritesForLogout(id: string) {
    if (!id || id.length > 256) {
        throw new TypeError('Delivery logout guard ID is invalid');
    }
    activeDeliveryLogoutId = id;
    try {
        deliverySessionStorage()?.setItem(deliveryLogoutWriteGuardKey, id);
    } catch {
        // The module guard still protects this browser context.
    }
}

export function deliveryOfflineWriteBlockReason():
    | 'logout'
    | 'stale-session'
    | null {
    const currentGeneration =
        deliverySessionStorageValue(deliverySessionGenerationKey) ??
        sharedDeliverySessionGeneration;
    if (
        currentGeneration !== null &&
        currentGeneration !== documentDeliverySessionGeneration
    ) {
        return 'stale-session';
    }
    if (activeDeliveryLogoutId) return 'logout';
    try {
        const stored = deliverySessionStorage()?.getItem(
            deliveryLogoutWriteGuardKey,
        );
        if (!stored) return null;
        activeDeliveryLogoutId = stored;
        return 'logout';
    } catch {
        return null;
    }
}

export function deliveryOfflineWritesBlocked() {
    return deliveryOfflineWriteBlockReason() !== null;
}

export function assertDeliveryOfflineWritesAllowed() {
    if (deliveryOfflineWritesBlocked()) {
        throw new Error('Delivery logout is in progress');
    }
}

export function resetDeliveryOfflineWritesForFreshDocument() {
    activeDeliveryLogoutId = null;
    documentDeliverySessionGeneration =
        deliverySessionStorageValue(deliverySessionGenerationKey) ??
        sharedDeliverySessionGeneration;
    try {
        deliverySessionStorage()?.removeItem(deliveryLogoutWriteGuardKey);
    } catch {
        // An unavailable storage guard cannot contain durable delivery data.
    }
}

function isDeliveryLogoutSignal(value: unknown): value is DeliveryLogoutSignal {
    return (
        typeof value === 'object' &&
        value !== null &&
        'version' in value &&
        value.version === 1 &&
        'kind' in value &&
        (value.kind === 'logout' ||
            value.kind === 'logout-completed' ||
            value.kind === 'logout-failed' ||
            value.kind === 'session-resumed') &&
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
        case 'session-resumed':
            return deliverySessionResumedEvent;
    }
}

function publishDeliverySessionSignal(signal: DeliveryLogoutSignal) {
    if (typeof window === 'undefined') return;
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
    blockDeliveryOfflineWritesForLogout(signal.id);
    publishDeliverySessionSignal(signal);
    return signal.id;
}

export function publishDeliveryLogoutCompleted(id: string) {
    publishDeliverySessionSignal(logoutSignal('logout-completed', id));
}

export function publishDeliveryLogoutFailed(id: string) {
    publishDeliverySessionSignal(logoutSignal('logout-failed', id));
}

export function publishDeliverySessionResumed() {
    const signal = logoutSignal('session-resumed');
    sharedDeliverySessionGeneration = signal.id;
    try {
        const storage = deliverySessionStorage();
        storage?.setItem(deliverySessionGenerationKey, signal.id);
        storage?.removeItem(deliveryLogoutWriteGuardKey);
    } catch {
        // The full-page login transition replaces this guarded document.
    }
    publishDeliverySessionSignal(signal);
    return signal.id;
}

export function subscribeToRemoteDeliveryLogout({
    onLogout,
    onCompleted,
    onFailed,
    onResumed,
}: {
    onLogout: () => void;
    onCompleted: () => void;
    onFailed: () => void;
    onResumed: () => void;
}) {
    let lastSignalKey: string | null = null;
    const receive = (value: unknown) => {
        if (!isDeliveryLogoutSignal(value)) return;
        const signalKey = `${value.kind}:${value.id}`;
        if (signalKey === lastSignalKey) return;
        lastSignalKey = signalKey;
        if (value.kind === 'logout') {
            blockDeliveryOfflineWritesForLogout(value.id);
            onLogout();
        } else if (value.kind === 'logout-completed') onCompleted();
        else if (value.kind === 'logout-failed') onFailed();
        else {
            sharedDeliverySessionGeneration = value.id;
            onResumed();
        }
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
        if (
            event.key === deliverySessionGenerationKey &&
            event.newValue &&
            event.newValue !== documentDeliverySessionGeneration
        ) {
            sharedDeliverySessionGeneration = event.newValue;
            onResumed();
            return;
        }
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
