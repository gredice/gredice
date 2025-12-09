'use client';

import { client } from '@gredice/client';
import { NuqsAdapter } from '@gredice/ui/nuqs';
import { AuthProvider } from '@signalco/auth-client/components';
import { NotificationsContainer } from '@signalco/ui-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
};

async function currentUserFactory() {
    const response = await client().api.users.current.$get();
    if (response.status < 200 || response.status > 299) {
        console.warn('Failed to fetch current user:', response.statusText);
        return null;
    }

    return (await response.json()) as User;
}

const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="light">
                    <AuthProvider currentUserFactory={currentUserFactory}>
                        {children}
                        <NotificationsContainer />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
