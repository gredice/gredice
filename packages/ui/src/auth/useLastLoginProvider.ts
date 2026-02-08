'use client';

import { useEffect, useState } from 'react';

export type OAuthProvider = 'google' | 'facebook';

const defaultDelaysMs = [0, 250, 750];

export function useLastLoginProvider(
    fetchLastLogin: () => Promise<Response>,
    delaysMs: number[] = defaultDelaysMs,
) {
    const [lastLoginProvider, setLastLoginProvider] = useState<OAuthProvider>();

    useEffect(() => {
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
                    const response = await fetchLastLogin();
                    if (!response.ok) {
                        continue;
                    }

                    const data: unknown = await response.json();
                    if (
                        data &&
                        typeof data === 'object' &&
                        'provider' in data
                    ) {
                        const provider = data.provider;
                        if (
                            (provider === 'google' ||
                                provider === 'facebook') &&
                            isMounted
                        ) {
                            setLastLoginProvider(provider);
                        }
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
    }, [delaysMs, fetchLastLogin]);

    return lastLoginProvider;
}
