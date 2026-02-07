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
                router.push('/');
                return;
            }

            const token = searchParams.get('token');
            const refreshToken = searchParams.get('refreshToken');

            if (token) {
                // Exchange tokens for httpOnly cookies via local route handler
                await fetch('/api/oauth-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, refreshToken }),
                });
            }

            await queryClient.invalidateQueries();
            router.push('/');
        };

        handleGoogleCallback();
    }, [router, searchParams, queryClient]);

    return null;
}
