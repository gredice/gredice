'use client';

import { client } from '@gredice/client';
import { useCurrentUser } from '@signalco/auth-client';
import { useEffect, useState } from 'react';
import type { User } from './ClientAppProvider';

function base64UrlToUint8Array(value: string) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = typeof window !== 'undefined' ? window.atob(base64) : '';
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

function getNavigatorPlatform() {
    if (typeof navigator === 'undefined') {
        return undefined;
    }

    const uaData = (
        navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData;
    return uaData?.platform ?? navigator.platform;
}

export function PushNotificationManager() {
    const { data } = useCurrentUser<User>();
    const isLoggedIn = Boolean(data?.isLogginedIn && data.user);
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        if (!isLoggedIn) {
            setAttempted(false);

            if (
                typeof window === 'undefined' ||
                !('serviceWorker' in navigator) ||
                !('PushManager' in window)
            ) {
                return;
            }

            void (async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription =
                        await registration.pushManager.getSubscription();
                    if (!subscription) {
                        return;
                    }

                    try {
                        await client().api.notifications.push.subscriptions.$delete(
                            {
                                json: { endpoint: subscription.endpoint },
                            },
                        );
                    } catch (error) {
                        console.warn(
                            'Failed to remove push subscription during sign-out',
                            error,
                        );
                    }

                    await subscription.unsubscribe();
                } catch (error) {
                    console.warn('Failed to clean up push subscription', error);
                }
            })();
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn || attempted) {
            return;
        }
        setAttempted(true);

        if (
            typeof window === 'undefined' ||
            !('serviceWorker' in navigator) ||
            !('PushManager' in window) ||
            typeof Notification === 'undefined'
        ) {
            return;
        }

        const registerPush = async () => {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
                const registration = await navigator.serviceWorker.ready;

                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }

                if (permission !== 'granted') {
                    const existing =
                        await registration.pushManager.getSubscription();
                    if (existing) {
                        try {
                            await client().api.notifications.push.subscriptions.$delete(
                                {
                                    json: { endpoint: existing.endpoint },
                                },
                            );
                        } catch (error) {
                            console.warn(
                                'Failed to remove push subscription after permission denial',
                                error,
                            );
                        }
                        await existing.unsubscribe();
                    }
                    return;
                }

                const publicKeyResponse =
                    await client().api.notifications.push['public-key'].$get();
                if (publicKeyResponse.status !== 200) {
                    console.warn('Web push is not configured on the API');
                    return;
                }

                const { publicKey } = (await publicKeyResponse.json()) as {
                    publicKey: string;
                };

                const applicationServerKey = base64UrlToUint8Array(publicKey);
                let subscription =
                    await registration.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey,
                    });
                }

                const json = subscription.toJSON();
                if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
                    console.warn(
                        'Received incomplete push subscription payload',
                    );
                    return;
                }

                await client().api.notifications.push.subscriptions.$post({
                    json: {
                        subscription: {
                            endpoint: json.endpoint,
                            expirationTime: json.expirationTime ?? null,
                            keys: {
                                p256dh: json.keys.p256dh,
                                auth: json.keys.auth,
                            },
                        },
                        metadata: {
                            userAgent:
                                typeof navigator !== 'undefined'
                                    ? navigator.userAgent
                                    : undefined,
                            platform: getNavigatorPlatform(),
                        },
                    },
                });
            } catch (error) {
                console.error(
                    'Failed to register web push subscription',
                    error,
                );
            }
        };

        void registerPush();
    }, [attempted, isLoggedIn]);

    return null;
}
