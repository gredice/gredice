import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { SunflowersHud } from '../../../packages/game/src/hud/SunflowersHud';
import { SunflowersList } from '../../../packages/game/src/shared-ui/sunflowers/SunflowersList';

function createSunflowersHudQueryClient({
    accountSunflowers,
    cartSunflowers,
    history = [],
}: {
    accountSunflowers: number;
    cartSunflowers: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['accounts', 'current'], {
        id: 'test-account',
        name: 'Test Account',
        sunflowers: {
            amount: accountSunflowers,
            history,
        },
    });
    queryClient.setQueryData(['accounts', 'current', 'sunflowers', 'daily'], {
        current: { amount: 0, day: 1 },
        next: { amount: 1, day: 2 },
    });
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items: [],
        notes: [],
        total: 0,
        totalSunflowers: cartSunflowers,
    });

    return queryClient;
}

function SunflowersHudTestProviders({
    accountSunflowers,
    cartSunflowers,
    history,
    children,
}: PropsWithChildren<{
    accountSunflowers: number;
    cartSunflowers: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}>) {
    const queryClient = useMemo(
        () =>
            createSunflowersHudQueryClient({
                accountSunflowers,
                cartSunflowers,
                history,
            }),
        [accountSunflowers, cartSunflowers, history],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            {children}
        </ReactQuery.QueryClientProvider>
    );
}

export function SunflowersHudStory({
    accountSunflowers = 9034,
    cartSunflowers = 10470,
}: {
    accountSunflowers?: number;
    cartSunflowers?: number;
}) {
    return (
        <div className="min-h-96 p-12">
            <SunflowersHudTestProviders
                accountSunflowers={accountSunflowers}
                cartSunflowers={cartSunflowers}
            >
                <SunflowersHud />
            </SunflowersHudTestProviders>
        </div>
    );
}

export function SunflowersPendingDetailsStory({
    accountSunflowers = 9034,
    cartSunflowers = 10470,
    history,
}: {
    accountSunflowers?: number;
    cartSunflowers?: number;
    history?: Array<{
        amount: number;
        createdAt: string;
        id: number;
        reason: string;
    }>;
}) {
    return (
        <div className="w-80 p-4">
            <SunflowersHudTestProviders
                accountSunflowers={accountSunflowers}
                cartSunflowers={cartSunflowers}
                history={history}
            >
                <SunflowersList limit={5} pendingSunflowers={cartSunflowers} />
            </SunflowersHudTestProviders>
        </div>
    );
}
