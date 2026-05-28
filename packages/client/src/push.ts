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
};

export type BrowserPushSubscribeOptions = {
    applicationServerKey?: ArrayBuffer | ArrayBufferView | string | null;
    userVisibleOnly?: boolean;
};

export type BrowserPushManager = {
    getSubscription(): Promise<BrowserPushSubscription | null>;
    subscribe(
        options?: BrowserPushSubscribeOptions,
    ): Promise<BrowserPushSubscription>;
};

export type PushDeviceMetadata = Omit<
    PushDeviceRegistrationPayload,
    'endpoint' | 'keys' | 'permissionState'
>;

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
}: {
    applicationServerKey: string;
    metadata: PushDeviceMetadata;
    persistSubscription: (
        payload: PushDeviceRegistrationPayload,
    ) => Promise<void>;
    pushManager: BrowserPushManager;
}): Promise<PushDeviceRegistrationPayload> {
    const existingSubscription = await pushManager.getSubscription();
    const subscription =
        existingSubscription ??
        (await pushManager.subscribe({
            applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
            userVisibleOnly: true,
        }));
    const payload = pushSubscriptionPayload(subscription, metadata);

    if (!payload) {
        throw new Error('Push subscription is missing endpoint or keys.');
    }

    await persistSubscription(payload);
    return payload;
}
