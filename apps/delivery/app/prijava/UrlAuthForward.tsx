'use client';

import { useEffect } from 'react';
import {
    buildDeliveryLoginFailureReturnTarget,
    type DeliveryLoginFailure,
    safeDeliveryReturnTarget,
} from '../../lib/deliveryDeepLink';
import { publishDeliverySessionResumed } from '../../lib/deliveryOfflineEvents';

export function UrlAuthForward({
    returnTarget,
    hasError = false,
}: {
    returnTarget: string;
    hasError?: boolean;
}) {
    useEffect(() => {
        const forward = async () => {
            const safeReturnTarget = safeDeliveryReturnTarget(returnTarget);
            const forwardFailure = (failure: DeliveryLoginFailure) => {
                window.location.replace(
                    buildDeliveryLoginFailureReturnTarget(
                        safeReturnTarget,
                        failure,
                    ),
                );
            };
            if (hasError) {
                forwardFailure('oauth-provider');
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
                    if (response.ok) {
                        publishDeliverySessionResumed();
                        window.location.replace(safeReturnTarget);
                        return;
                    }
                } catch {
                    // The validated target is also the safe recovery path.
                }
                forwardFailure('oauth-token-exchange');
                return;
            }
            forwardFailure('oauth-missing-token');
        };
        void forward();
    }, [hasError, returnTarget]);

    return null;
}
