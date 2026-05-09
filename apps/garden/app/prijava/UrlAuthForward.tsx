'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function UrlAuthForward() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleGoogleCallback = async () => {
            const error = searchParams.get('error');
            if (error) {
                // TODO: Display notification
                console.error('Authentication error:', error);
                router.replace('/');
                return;
            }

            // Read tokens from URL fragment (hash) to avoid server logs/referrer leakage
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('token');
            const refreshToken = params.get('refreshToken');

            // Clear tokens from URL immediately to minimize exposure
            if (hash) {
                window.history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search,
                );
            }

            if (token) {
                // Exchange tokens for httpOnly cookies via local route handler
                try {
                    const response = await fetch('/api/oauth-callback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, refreshToken }),
                    });

                    if (!response.ok) {
                        // TODO: Display notification
                        console.error(
                            'Authentication callback failed with status:',
                            response.status,
                        );
                        router.replace('/');
                        return;
                    }
                } catch (err) {
                    // TODO: Display notification
                    console.error(
                        'Network error during authentication callback:',
                        err,
                    );
                    router.replace('/');
                    return;
                }
            }

            await queryClient.invalidateQueries();
            router.replace('/');
        };

        handleGoogleCallback();
    }, [router, searchParams, queryClient]);

    return null;
}
