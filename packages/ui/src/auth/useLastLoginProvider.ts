'use client';

import { useEffect, useState } from 'react';

import {
    type FetchLastLogin,
    getLastLoginProvider,
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
                    const provider = await getLastLoginProvider(fetchLastLogin);
                    if (isMounted) {
                        setLastLoginProvider(provider);
                    }
                    return;
                } catch {
                    // retry
                }
            }
        };

        void fetchLastLoginProvider();

        return () => {
            isMounted = false;
        };
    }, [delaysMs, enabled, fetchLastLogin]);

    return enabled ? lastLoginProvider : undefined;
}
