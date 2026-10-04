import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useMemo, useState } from 'react';
import { UrlAuthForward } from '../app/prijava/UrlAuthForward';

function createOAuthCallbackQueryClient() {
    return new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
}

export function UrlAuthForwardStory({ search = '' }: { search?: string }) {
    const [lastRoute, setLastRoute] = useState('none');
    const [replaceCount, setReplaceCount] = useState(0);
    const queryClient = useMemo(createOAuthCallbackQueryClient, []);
    const searchParams = useMemo(() => new URLSearchParams(search), [search]);
    const router = useMemo(
        () =>
            ({
                back: () => undefined,
                bfcacheId: 'oauth-callback-test',
                forward: () => undefined,
                prefetch: () => undefined,
                push: () => undefined,
                refresh: () => undefined,
                replace: (href) => {
                    setLastRoute(href);
                    setReplaceCount((count) => count + 1);
                },
            }) satisfies AppRouterInstance,
        [],
    );

    return (
        <AppRouterContext.Provider value={router}>
            <SearchParamsContext.Provider value={searchParams}>
                <QueryClientProvider client={queryClient}>
                    <UrlAuthForward />
                    <output data-testid="oauth-callback-route">
                        {lastRoute}
                    </output>
                    <output data-testid="oauth-callback-replace-count">
                        {replaceCount}
                    </output>
                </QueryClientProvider>
            </SearchParamsContext.Provider>
        </AppRouterContext.Provider>
    );
}
