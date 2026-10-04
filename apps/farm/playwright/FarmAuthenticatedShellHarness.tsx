'use client';

import { AuthProvider } from '@gredice/ui/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { FarmAuthenticatedShell } from '../components/navigation/FarmAuthenticatedShell';

async function noCurrentUser() {
    return null;
}

export function FarmAuthenticatedShellHarness() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { retry: false },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider currentUserFactory={noCurrentUser}>
                <FarmAuthenticatedShell pathname="/">
                    <main className="flex min-h-[60rem] flex-col justify-end p-2">
                        <button
                            className="min-h-11 w-full"
                            data-final-content-action
                            type="button"
                        >
                            Zadnja radnja sadržaja
                        </button>
                    </main>
                </FarmAuthenticatedShell>
            </AuthProvider>
        </QueryClientProvider>
    );
}
