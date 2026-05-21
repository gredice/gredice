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
