import { useCallback, useEffect, useMemo, useState } from 'react';

type PushSetupStatus =
    | 'unsupported'
    | 'default'
    | 'denied'
    | 'granted'
    | 'prompt-dismissed';

const pushPromptDismissedKey = 'game:push:prompt-dismissed';
const pushServiceWorkerPath = '/push-notifications-sw.js';

function readPromptDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(pushPromptDismissedKey) === '1';
}

async function ensurePushServiceWorkerRegistered() {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        typeof window.isSecureContext !== 'boolean' ||
        !window.isSecureContext
    ) {
        return;
    }

    const existing = await navigator.serviceWorker.getRegistration(
        pushServiceWorkerPath,
    );
    if (existing) {
        await existing.update();
        return;
    }

    await navigator.serviceWorker.register(pushServiceWorkerPath, {
        scope: '/',
    });
}

function resolvePermissionStatus(): PushSetupStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }

    if (window.Notification.permission === 'denied') return 'denied';
    if (window.Notification.permission === 'granted') return 'granted';
    return readPromptDismissed() ? 'prompt-dismissed' : 'default';
}

export function usePushPermissionOnboarding() {
    const [status, setStatus] = useState<PushSetupStatus>(() =>
        resolvePermissionStatus(),
    );

    useEffect(() => {
        setStatus(resolvePermissionStatus());
    }, []);

    const dismissPrompt = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(pushPromptDismissedKey, '1');
        }
        setStatus('prompt-dismissed');
    }, []);

    const requestPermission = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setStatus('unsupported');
            return 'unsupported' as const;
        }

        const permission = await window.Notification.requestPermission();
        if (permission === 'granted') {
            await ensurePushServiceWorkerRegistered();
            setStatus('granted');
            return 'granted' as const;
        }

        if (permission === 'denied') {
            setStatus('denied');
            return 'denied' as const;
        }

        setStatus('default');
        return 'default' as const;
    }, []);

    const canPrompt = useMemo(() => status === 'default', [status]);

    return {
        status,
        canPrompt,
        dismissPrompt,
        requestPermission,
    };
}
