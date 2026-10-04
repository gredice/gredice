import { clientAuthenticated } from '@gredice/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    type PushDeviceMetadata,
    type PushDeviceRegistrationPayload,
    subscribePushDevice,
} from './pushSubscription';

export type PushSetupStatus =
    | 'unsupported'
    | 'unconfigured'
    | 'default'
    | 'denied'
    | 'failed'
    | 'granted'
    | 'subscribed'
    | 'prompt-dismissed';

type PushPermissionRefreshDocument = Pick<
    Document,
    'addEventListener' | 'removeEventListener' | 'visibilityState'
>;

type PushPermissionRefreshWindow = Pick<
    Window,
    'addEventListener' | 'removeEventListener'
>;

export function pushSetupStatusAfterSubscriptionCheck(
    permissionStatus: PushSetupStatus,
    hasSubscription: boolean,
) {
    return permissionStatus === 'granted' && hasSubscription
        ? 'subscribed'
        : permissionStatus;
}

export function observePushPermissionRefresh({
    documentTarget,
    refresh,
    windowTarget,
}: {
    documentTarget: PushPermissionRefreshDocument;
    refresh: () => void;
    windowTarget: PushPermissionRefreshWindow;
}) {
    const refreshWhenVisible = () => {
        if (documentTarget.visibilityState === 'visible') refresh();
    };
    windowTarget.addEventListener('focus', refresh);
    documentTarget.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
        windowTarget.removeEventListener('focus', refresh);
        documentTarget.removeEventListener(
            'visibilitychange',
            refreshWhenVisible,
        );
    };
}

const pushPromptDismissedKey = 'game:push:prompt-dismissed';
const pushDeviceIdKey = 'game:push:device-id';
const pushServiceWorkerPath = '/push-notifications-sw.js';
const webPushVapidPublicKey =
    process.env.NEXT_PUBLIC_GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY;

function readPromptDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(pushPromptDismissedKey) === '1';
}

function readOrCreatePushDeviceId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const existing = window.localStorage.getItem(pushDeviceIdKey);
    if (existing) return existing;

    const id =
        window.crypto.randomUUID?.() ??
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(pushDeviceIdKey, id);
    return id;
}

function pushDeviceMetadata(): PushDeviceMetadata {
    if (typeof window === 'undefined') {
        return {};
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const platform = navigator.platform || undefined;

    return {
        deviceId: readOrCreatePushDeviceId(),
        deviceLabel: platform ? `Ovaj uređaj (${platform})` : 'Ovaj uređaj',
        locale: navigator.language || undefined,
        platform,
        timezone,
        userAgent: navigator.userAgent || undefined,
    };
}

async function persistPushSubscription(payload: PushDeviceRegistrationPayload) {
    const response =
        await clientAuthenticated().api.notifications.devices.$post({
            json: payload,
        });
    if (!response.ok) {
        throw new Error('Push subscription was not saved.');
    }
}

async function ensurePushServiceWorkerRegistered(): Promise<
    ServiceWorkerRegistration | undefined
> {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        typeof window.isSecureContext !== 'boolean' ||
        !window.isSecureContext
    ) {
        return undefined;
    }

    const existing = await navigator.serviceWorker.getRegistration(
        pushServiceWorkerPath,
    );
    if (existing) {
        await existing.update();
        return existing;
    }

    await navigator.serviceWorker.register(pushServiceWorkerPath, {
        scope: '/',
    });
    return navigator.serviceWorker.ready;
}

function resolvePermissionStatus(): PushSetupStatus {
    if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        typeof window.isSecureContext !== 'boolean' ||
        !window.isSecureContext
    ) {
        return 'unsupported';
    }

    if (!webPushVapidPublicKey) return 'unconfigured';
    if (window.Notification.permission === 'denied') return 'denied';
    if (window.Notification.permission === 'granted') return 'granted';
    return readPromptDismissed() ? 'prompt-dismissed' : 'default';
}

async function browserHasPushSubscription() {
    const registration = await navigator.serviceWorker.getRegistration(
        pushServiceWorkerPath,
    );
    return Boolean(await registration?.pushManager.getSubscription());
}

export function usePushPermissionOnboarding() {
    const initialStatus = resolvePermissionStatus();
    const [status, setStatus] = useState<PushSetupStatus>(initialStatus);
    const [subscriptionChecked, setSubscriptionChecked] = useState(
        initialStatus !== 'granted',
    );

    useEffect(() => {
        let refreshVersion = 0;
        const refresh = () => {
            const version = ++refreshVersion;
            const permissionStatus = resolvePermissionStatus();
            if (permissionStatus !== 'granted') {
                setStatus(permissionStatus);
                setSubscriptionChecked(true);
                return;
            }
            setSubscriptionChecked(false);
            void browserHasPushSubscription()
                .then((hasSubscription) => {
                    if (version !== refreshVersion) return;
                    setStatus(
                        pushSetupStatusAfterSubscriptionCheck(
                            permissionStatus,
                            hasSubscription,
                        ),
                    );
                    setSubscriptionChecked(true);
                })
                .catch(() => {
                    if (version !== refreshVersion) return;
                    setStatus('failed');
                    setSubscriptionChecked(true);
                });
        };
        refresh();
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        const stopObserving = observePushPermissionRefresh({
            documentTarget: document,
            refresh,
            windowTarget: window,
        });
        return () => {
            refreshVersion += 1;
            stopObserving();
        };
    }, []);

    const dismissPrompt = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(pushPromptDismissedKey, '1');
        }
        setStatus('prompt-dismissed');
    }, []);

    const requestPermission = useCallback(
        async ({
            replaceExistingSubscription = false,
        }: {
            replaceExistingSubscription?: boolean;
        } = {}) => {
            if (
                typeof window === 'undefined' ||
                !('Notification' in window) ||
                !('PushManager' in window)
            ) {
                setStatus('unsupported');
                setSubscriptionChecked(true);
                return 'unsupported' as const;
            }

            if (!webPushVapidPublicKey) {
                setStatus('unconfigured');
                setSubscriptionChecked(true);
                return 'unconfigured' as const;
            }

            try {
                const permission =
                    window.Notification.permission === 'granted'
                        ? 'granted'
                        : await window.Notification.requestPermission();
                if (permission === 'granted') {
                    const registration =
                        await ensurePushServiceWorkerRegistered();
                    if (!registration) {
                        setStatus('unsupported');
                        setSubscriptionChecked(true);
                        return 'unsupported' as const;
                    }
                    await subscribePushDevice({
                        applicationServerKey: webPushVapidPublicKey,
                        metadata: pushDeviceMetadata(),
                        persistSubscription: persistPushSubscription,
                        pushManager: registration.pushManager,
                        replaceExistingSubscription,
                    });
                    setStatus('subscribed');
                    setSubscriptionChecked(true);
                    return 'subscribed' as const;
                }

                if (permission === 'denied') {
                    setStatus('denied');
                    setSubscriptionChecked(true);
                    return 'denied' as const;
                }

                setStatus('default');
                setSubscriptionChecked(true);
                return 'default' as const;
            } catch {
                setStatus('failed');
                setSubscriptionChecked(true);
                return 'failed' as const;
            }
        },
        [],
    );

    const canPrompt = useMemo(
        () =>
            status === 'default' || status === 'failed' || status === 'granted',
        [status],
    );

    return {
        status,
        canPrompt,
        dismissPrompt,
        requestPermission,
        subscriptionChecked,
    };
}
