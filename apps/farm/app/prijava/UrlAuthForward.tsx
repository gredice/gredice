'use client';

import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function UrlAuthForward() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    useEffect(() => {
        const forwardAuthSession = async () => {
            const error = searchParams.get('error');
            if (error) {
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
                        console.error(
                            'OAuth callback failed:',
                            response.status,
                            response.statusText,
                        );
                        router.replace('/');
                        return;
                    }
                } catch (fetchError) {
                    console.error('OAuth callback request error:', fetchError);
                    router.replace('/');
                    return;
                }
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.replace('/');
        };

        void forwardAuthSession();
    }, [queryClient, router, searchParams]);

    return null;
}
