'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { currentUserQueryKey } from '../../hooks/useCurrentUser';

function safeReturnPath(value: string | null) {
    if (!value?.startsWith('/') || value.startsWith('//')) {
        return '/';
    }

    return value;
}

export function UrlAuthForward() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();

    useEffect(() => {
        const forwardAuthSession = async () => {
            const returnTo = safeReturnPath(searchParams.get('returnTo'));
            const error = searchParams.get('error');
            if (error) {
                console.error('Authentication error:', error);
                window.location.replace(returnTo);
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
                try {
                    const response = await fetch('/api/oauth-callback', {
                        body: JSON.stringify({ token, refreshToken }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    });

                    if (!response.ok) {
                        console.error(
                            'OAuth callback failed:',
                            response.status,
                            response.statusText,
                        );
                        window.location.replace(returnTo);
                        return;
                    }
                } catch (fetchError) {
                    console.error('OAuth callback request error:', fetchError);
                    window.location.replace(returnTo);
                    return;
                }
            }

            await queryClient.invalidateQueries({
                queryKey: currentUserQueryKey,
            });
            window.location.replace(returnTo);
        };

        void forwardAuthSession();
    }, [queryClient, searchParams]);

    return null;
}
