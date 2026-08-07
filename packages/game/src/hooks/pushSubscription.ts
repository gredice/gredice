export type PushDeviceRegistrationPayload = {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    deviceId?: string;
    deviceLabel?: string;
    browserName?: string;
    browserVersion?: string;
    platform?: string;
    userAgent?: string;
    locale?: string;
    timezone?: string;
    permissionState: 'default' | 'granted' | 'denied';
};

export type BrowserPushSubscriptionJson = {
    endpoint?: string;
    keys?: {
        p256dh?: string;
        auth?: string;
    };
};

export type BrowserPushSubscription = {
    endpoint: string;
    toJSON(): BrowserPushSubscriptionJson;
    unsubscribe(): Promise<boolean>;
};

export type BrowserPushManager = {
    getSubscription(): Promise<BrowserPushSubscription | null>;
    subscribe(
        options?: PushSubscriptionOptionsInit,
    ): Promise<BrowserPushSubscription>;
};

export type PushDeviceMetadata = Omit<
    PushDeviceRegistrationPayload,
    'endpoint' | 'keys' | 'permissionState'
>;

export type PushDeviceRecoveryState = {
    permissionState?: string | null;
    revokedAt?: Date | string | null;
};

type PushDevicePermissionState = PushDeviceRecoveryState & {
    deviceId?: string | null;
    enabled: boolean;
    id: string;
};

export type CurrentPushDevicePermissionReconciliation = {
    id: string;
    permissionState: 'default' | 'denied';
};

export type BrowserPushRecoveryState = {
    status: string;
    subscriptionChecked: boolean;
};

export function browserPushNeedsSubscriptionRecovery({
    status,
    subscriptionChecked,
}: BrowserPushRecoveryState) {
    if (!subscriptionChecked && status === 'granted') return false;
    return status !== 'subscribed';
}

export function pushDeviceNeedsSubscriptionRecovery(
    device: PushDeviceRecoveryState,
) {
    return Boolean(device.revokedAt) || device.permissionState !== 'granted';
}

export function currentPushDevicePermissionReconciliation({
    browserPermission,
    currentDeviceId,
    devices,
}: {
    browserPermission: NotificationPermission;
    currentDeviceId?: string;
    devices: PushDevicePermissionState[];
}): CurrentPushDevicePermissionReconciliation | null {
    if (!currentDeviceId || browserPermission === 'granted') return null;

    const currentDevice = devices.find(
        (device) => device.deviceId === currentDeviceId,
    );
    if (!currentDevice || currentDevice.revokedAt) return null;
    if (
        !currentDevice.enabled &&
        currentDevice.permissionState === browserPermission
    ) {
        return null;
    }

    return {
        id: currentDevice.id,
        permissionState: browserPermission,
    };
}

function safeString(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const rawData = globalThis.atob(base64);
    const output = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
        output[index] = rawData.charCodeAt(index);
    }

    return output;
}

export function pushSubscriptionPayload(
    subscription: BrowserPushSubscription,
    metadata: PushDeviceMetadata,
): PushDeviceRegistrationPayload | null {
    const json = subscription.toJSON();
    const endpoint =
        safeString(json.endpoint) ?? safeString(subscription.endpoint);
    const p256dh = safeString(json.keys?.p256dh);
    const auth = safeString(json.keys?.auth);

    if (!endpoint || !p256dh || !auth) {
        return null;
    }

    return {
        ...metadata,
        endpoint,
        keys: { p256dh, auth },
        permissionState: 'granted',
    };
}

export async function subscribePushDevice({
    applicationServerKey,
    metadata,
    persistSubscription,
    pushManager,
    replaceExistingSubscription = false,
}: {
    applicationServerKey: string;
    metadata: PushDeviceMetadata;
    persistSubscription: (
        payload: PushDeviceRegistrationPayload,
    ) => Promise<void>;
    pushManager: BrowserPushManager;
    replaceExistingSubscription?: boolean;
}): Promise<PushDeviceRegistrationPayload> {
    const existingSubscription = await pushManager.getSubscription();
    if (existingSubscription && replaceExistingSubscription) {
        const removed = await existingSubscription.unsubscribe();
        if (!removed) {
            throw new Error('Stale push subscription could not be removed.');
        }
    }
    const subscription =
        existingSubscription && !replaceExistingSubscription
            ? existingSubscription
            : await pushManager.subscribe({
                  applicationServerKey:
                      urlBase64ToUint8Array(applicationServerKey),
                  userVisibleOnly: true,
              });
    const payload = pushSubscriptionPayload(subscription, metadata);

    if (!payload) {
        throw new Error('Push subscription is missing endpoint or keys.');
    }

    await persistSubscription(payload);
    return payload;
}
