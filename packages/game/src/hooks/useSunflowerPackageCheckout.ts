import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentAccountKeys } from './useCurrentAccount';
import { sunflowerPackageKeys } from './useSunflowerPackages';

type SunflowerPackageCheckoutInput = {
    code: string;
};

export class SunflowerPackageCheckoutError extends Error {
    constructor(public readonly reason: string) {
        super(reason);
        this.name = 'SunflowerPackageCheckoutError';
    }
}

function currentReturnPath() {
    if (typeof window === 'undefined') {
        return '/';
    }
    return `${window.location.pathname}${window.location.search}`;
}

export function useSunflowerPackageCheckout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ code }: SunflowerPackageCheckoutInput) => {
            const response = await clientAuthenticated().api.checkout[
                'sunflower-packages'
            ][':code'].$post({
                param: { code },
                json: {
                    returnContext: {
                        source: 'garden',
                        path: currentReturnPath(),
                    },
                },
            });

            if (response.status === 409) {
                const body = await response.json();
                throw new SunflowerPackageCheckoutError(
                    'reason' in body && typeof body.reason === 'string'
                        ? body.reason
                        : 'not_eligible',
                );
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to create sunflower package checkout: ${response.status} ${response.statusText}`,
                );
            }

            return response.json();
        },
        onError: (error) => {
            if (
                error instanceof SunflowerPackageCheckoutError &&
                error.reason === 'already_used'
            ) {
                queryClient.invalidateQueries({
                    queryKey: sunflowerPackageKeys,
                });
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: currentAccountKeys });
            queryClient.invalidateQueries({ queryKey: sunflowerPackageKeys });
            if (data.url) {
                window.location.href = data.url;
            }
        },
        scope: {
            id: 'sunflower-package-checkout',
        },
    });
}
