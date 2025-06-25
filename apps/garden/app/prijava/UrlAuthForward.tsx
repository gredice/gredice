'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

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
            }

            const token = searchParams.get('session');
            if (token) {
                localStorage.setItem('gredice-token', token);
                await queryClient.invalidateQueries();
            }
            router.push('/');
        }

        handleGoogleCallback()
    }, [router]);

    return null;
}
