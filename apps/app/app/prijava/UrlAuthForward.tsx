'use client';

import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { queryClient } from '../../components/providers/ClientAppProvider';
import { invalidatePage } from '../(actions)/sharedActions';

export function UrlAuthForward() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const forwardAuthSession = async () => {
            const error = searchParams.get('error');
            if (error) {
                console.error('Authentication error:', error);
                router.replace('/admin');
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
                        router.replace('/admin');
                        return;
                    }
                } catch (fetchError) {
                    console.error('OAuth callback request error:', fetchError);
                    router.replace('/admin');
                    return;
                }
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            await invalidatePage();
            router.replace('/admin');
        };

        void forwardAuthSession();
    }, [router, searchParams]);

    return null;
}
