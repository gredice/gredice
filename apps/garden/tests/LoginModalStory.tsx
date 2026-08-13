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

export function LoginModalStory({
    controlled = false,
    dismissible = false,
    returnTo,
}: {
    controlled?: boolean;
    dismissible?: boolean;
    returnTo?: string;
}) {
    const [lastRoute, setLastRoute] = useState('none');
    const [open, setOpen] = useState(true);
    const [openChangeCount, setOpenChangeCount] = useState(0);
    const [authenticatedCount, setAuthenticatedCount] = useState(0);
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
                <LoginModal
                    dismissible={dismissible}
                    onAuthenticated={
                        controlled
                            ? () => setAuthenticatedCount((count) => count + 1)
                            : undefined
                    }
                    onOpenChange={
                        controlled
                            ? (nextOpen) => {
                                  setOpen(nextOpen);
                                  setOpenChangeCount((count) => count + 1);
                              }
                            : undefined
                    }
                    open={controlled ? open : undefined}
                    returnTo={returnTo}
                />
                <output className="sr-only" data-testid="last-router-push">
                    {lastRoute}
                </output>
                <output
                    className="sr-only"
                    data-testid="login-modal-open-state"
                >
                    {open ? 'open' : 'closed'}
                </output>
                <output
                    className="sr-only"
                    data-testid="login-modal-open-change-count"
                >
                    {openChangeCount}
                </output>
                <output
                    className="sr-only"
                    data-testid="login-modal-authenticated-count"
                >
                    {authenticatedCount}
                </output>
            </ReactQuery.QueryClientProvider>
        </AppRouterContext.Provider>
    );
}
