'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function UrlAuthForward() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const forward = async () => {
            if (searchParams.get('error')) {
                router.replace('/');
                return;
            }
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('token');
            const refreshToken = params.get('refreshToken');
            if (hash) {
                window.history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search,
                );
            }
            if (token) {
                const response = await fetch('/api/oauth-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, refreshToken }),
                });
                if (!response.ok) {
                    router.replace('/');
                    return;
                }
            }
            router.replace('/');
            router.refresh();
        };
        void forward();
    }, [router, searchParams]);

    return null;
}
