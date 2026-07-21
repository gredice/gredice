import * as ReactQuery from '@tanstack/react-query';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useMemo, useState } from 'react';
import LoginModal from '../components/auth/LoginModal';

function createLoginModalQueryClient() {
    return new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
}

export function LoginModalStory() {
    const [lastRoute, setLastRoute] = useState('none');
    const queryClient = useMemo(createLoginModalQueryClient, []);
    const router = useMemo(
        () =>
            ({
                back: () => undefined,
                bfcacheId: 'login-modal-test',
                forward: () => undefined,
                prefetch: () => undefined,
                push: (href) => setLastRoute(href),
                refresh: () => undefined,
                replace: () => undefined,
            }) satisfies AppRouterInstance,
        [],
    );

    return (
        <AppRouterContext.Provider value={router}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <LoginModal />
                <output className="sr-only" data-testid="last-router-push">
                    {lastRoute}
                </output>
            </ReactQuery.QueryClientProvider>
        </AppRouterContext.Provider>
    );
}
