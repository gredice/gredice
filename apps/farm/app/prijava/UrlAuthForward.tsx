'use client';

import { setStoredTokens } from '@gredice/client';
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

            const token = searchParams.get('session');
            if (!token) {
                router.replace('/');
                return;
            }

            setStoredTokens({
                accessToken: token,
                refreshToken: searchParams.get('refreshToken'),
            });
            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.replace('/');
        };

        void forwardAuthSession();
    }, [queryClient, router, searchParams]);

    return null;
}
