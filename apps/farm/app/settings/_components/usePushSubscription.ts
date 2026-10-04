'use client';

import {
    clientAuthenticated,
    type PushDeviceMetadata,
    type PushDeviceRegistrationPayload,
    subscribePushDevice,
} from '@gredice/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type PushSetupStatus =
    | 'unsupported'
    | 'unconfigured'
    | 'default'
    | 'denied'
    | 'granted'
    | 'subscribed'
    | 'prompt-dismissed'
    | 'setup-failed';

export type PushSetupResult =
    | Exclude<PushSetupStatus, 'setup-failed'>
    | 'setup-failed';

const pushPromptDismissedKey = 'farm:push:prompt-dismissed';
export const pushDeviceIdKey = 'farm:push:device-id';
const pushServiceWorkerPath = '/push-notifications-sw.js';
const webPushVapidPublicKey =
    process.env.NEXT_PUBLIC_GREDICE_WEB_PUSH_VAPID_PUBLIC_KEY;

function readPromptDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(pushPromptDismissedKey) === '1';
}

function setPromptDismissed() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(pushPromptDismissedKey, '1');
}

function clearPromptDismissed() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(pushPromptDismissedKey);
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

export function usePushSubscription() {
    const [status, setStatus] = useState<PushSetupStatus>(() =>
        resolvePermissionStatus(),
    );
    const [error, setError] = useState<string | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function syncStatus() {
            const permissionStatus = resolvePermissionStatus();
            if (permissionStatus !== 'granted') {
                setStatus(permissionStatus);
                return;
            }

            const registration =
                typeof navigator !== 'undefined' && 'serviceWorker' in navigator
                    ? await navigator.serviceWorker.getRegistration(
                          pushServiceWorkerPath,
                      )
                    : undefined;
            const subscription =
                await registration?.pushManager.getSubscription();
            if (!cancelled) {
                setStatus(subscription ? 'subscribed' : 'granted');
            }
        }

        syncStatus().catch(() => {
            if (!cancelled) {
                setStatus(resolvePermissionStatus());
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const dismissPrompt = useCallback(() => {
        setPromptDismissed();
        setStatus('prompt-dismissed');
    }, []);

    const requestPermission =
        useCallback(async (): Promise<PushSetupResult> => {
            setError(null);

            if (
                typeof window === 'undefined' ||
                !('Notification' in window) ||
                !('PushManager' in window) ||
                !('serviceWorker' in navigator) ||
                typeof window.isSecureContext !== 'boolean' ||
                !window.isSecureContext
            ) {
                setStatus('unsupported');
                return 'unsupported' as const;
            }

            if (!webPushVapidPublicKey) {
                setStatus('unconfigured');
                return 'unconfigured' as const;
            }

            setIsRequesting(true);
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
                        return 'unsupported' as const;
                    }
                    await subscribePushDevice({
                        applicationServerKey: webPushVapidPublicKey,
                        metadata: pushDeviceMetadata(),
                        persistSubscription: persistPushSubscription,
                        pushManager: registration.pushManager,
                    });
                    clearPromptDismissed();
                    setStatus('subscribed');
                    return 'subscribed' as const;
                }

                if (permission === 'denied') {
                    setStatus('denied');
                    return 'denied' as const;
                }

                setPromptDismissed();
                setStatus('prompt-dismissed');
                return 'prompt-dismissed' as const;
            } catch {
                setError('Obavijesti nisu uključene. Pokušaj ponovno.');
                setStatus('setup-failed');
                return 'setup-failed' as const;
            } finally {
                setIsRequesting(false);
            }
        }, []);

    const revokeBrowserSubscription = useCallback(async () => {
        setError(null);

        if (
            typeof navigator === 'undefined' ||
            !('serviceWorker' in navigator)
        ) {
            setStatus(resolvePermissionStatus());
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration(
                pushServiceWorkerPath,
            );
            const subscription =
                await registration?.pushManager.getSubscription();
            const unsubscribed = (await subscription?.unsubscribe()) ?? false;
            setStatus(resolvePermissionStatus());
            return unsubscribed;
        } catch {
            setError(
                'Uređaj je uklonjen iz Gredica, ali preglednik nije potvrdio lokalno uklanjanje.',
            );
            setStatus(resolvePermissionStatus());
            return false;
        }
    }, []);

    const canPrompt = useMemo(
        () =>
            status === 'default' ||
            status === 'granted' ||
            status === 'prompt-dismissed' ||
            status === 'setup-failed',
        [status],
    );

    return {
        status,
        canPrompt,
        dismissPrompt,
        error,
        isRequesting,
        requestPermission,
        revokeBrowserSubscription,
    };
}
