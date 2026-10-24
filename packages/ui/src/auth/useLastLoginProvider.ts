'use client';

import { useEffect, useState } from 'react';

import {
    acquireLastLoginProvider,
    type FetchLastLogin,
    type OAuthProvider,
} from './lastLoginProviderRequest';

export type { OAuthProvider } from './lastLoginProviderRequest';

const defaultDelaysMs = [0, 250, 750];

export function useLastLoginProvider(
    fetchLastLogin: FetchLastLogin,
    delaysMs: number[] = defaultDelaysMs,
    enabled = true,
) {
    const [lastLoginProvider, setLastLoginProvider] = useState<OAuthProvider>();

    useEffect(() => {
        setLastLoginProvider(undefined);
        if (!enabled) return;
        let isMounted = true;
        let releaseRequest: (() => void) | undefined;

        const fetchLastLoginProvider = async () => {
            for (const delayMs of delaysMs) {
                if (!isMounted) {
                    return;
                }

                if (delayMs > 0) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, delayMs),
                    );
                    if (!isMounted) {
                        return;
                    }
                }

                try {
                    const request = acquireLastLoginProvider(fetchLastLogin);
                    releaseRequest = request.release;
                    const provider = await request.promise;
                    if (isMounted) {
                        setLastLoginProvider(provider);
                    }
                    return;
                } catch {
                    // retry
                } finally {
                    releaseRequest?.();
                    releaseRequest = undefined;
                }
            }
        };

        void fetchLastLoginProvider();

        return () => {
            isMounted = false;
            releaseRequest?.();
        };
    }, [delaysMs, enabled, fetchLastLogin]);

    return enabled ? lastLoginProvider : undefined;
}
