'use client';

import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { invalidatePage } from '../(actions)/sharedActions';
import { queryClient } from '../../components/providers/ClientAppProvider';

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
