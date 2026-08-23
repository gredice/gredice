'use client';

import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
    resolveGardenOAuthCallbackQuery,
    resolveGardenOAuthFragment,
} from '../../lib/auth/gardenAuthContinuation';

export function UrlAuthForward() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const hasStartedRef = useRef(false);
    const { failureReturnTo, hasServerError, returnTo } =
        resolveGardenOAuthCallbackQuery(searchParams.toString());

    useEffect(() => {
        if (hasStartedRef.current) {
            return;
        }
        hasStartedRef.current = true;

        const handleOAuthCallback = async () => {
            const hash = window.location.hash;
            const oauthFragment = resolveGardenOAuthFragment(hash);

            // Clear tokens from URL immediately to minimize exposure
            if (hash) {
                window.history.replaceState(
                    null,
                    '',
                    window.location.pathname + window.location.search,
                );
            }

            if (hasServerError || !oauthFragment) {
                console.error('OAuth callback could not be completed', {
                    reason: hasServerError
                        ? 'provider_or_callback_error'
                        : 'missing_or_invalid_fragment',
                });
                router.replace(failureReturnTo);
                return;
            }

            try {
                const response = await fetch('/api/oauth-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(oauthFragment),
                });

                if (!response.ok) {
                    console.error('OAuth cookie exchange was rejected', {
                        status: response.status,
                    });
                    router.replace(failureReturnTo);
                    return;
                }
            } catch {
                console.error('OAuth cookie exchange request failed');
                router.replace(failureReturnTo);
                return;
            }

            await queryClient
                .invalidateQueries({
                    queryKey: authCurrentUserQueryKeys,
                })
                .catch(() => undefined);
            router.replace(returnTo);
        };

        void handleOAuthCallback();
    }, [failureReturnTo, hasServerError, queryClient, returnTo, router]);

    return null;
}
