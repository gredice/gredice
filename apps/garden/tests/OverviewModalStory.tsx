import * as ReactQuery from '@tanstack/react-query';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
    PathnameContext,
    SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useMemo } from 'react';
import { OverviewModal } from '../../../packages/game/src/modals/OverviewModal';

function createOverviewModalQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    queryClient.setQueryData(['currentUser'], {
        avatarUrl: null,
        displayName: 'Test User',
        id: 'test-user',
        userName: 'test@example.com',
    });
    return queryClient;
}

export function OverviewModalStory() {
    const queryClient = useMemo(createOverviewModalQueryClient, []);
    const router = useMemo(
        () =>
            ({
                back: () => undefined,
                bfcacheId: 'overview-modal-test',
                forward: () => undefined,
                prefetch: () => undefined,
                push: () => undefined,
                refresh: () => undefined,
                replace: () => undefined,
            }) satisfies AppRouterInstance,
        [],
    );
    const searchParams = useMemo(() => new URLSearchParams('pregled=test'), []);

    return (
        <AppRouterContext.Provider value={router}>
            <PathnameContext.Provider value="/">
                <SearchParamsContext.Provider value={searchParams}>
                    <ReactQuery.QueryClientProvider client={queryClient}>
                        <OverviewModal />
                    </ReactQuery.QueryClientProvider>
                </SearchParamsContext.Provider>
            </PathnameContext.Provider>
        </AppRouterContext.Provider>
    );
}
