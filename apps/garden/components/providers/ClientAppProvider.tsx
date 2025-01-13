'use client';

import { AuthProvider } from '@signalco/auth-client/components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
};

async function currentUserFactory() {
    const response = await fetch('/api/users/current');
    if (response.status < 200 || response.status > 299) {
        return null;
    }

    return await response.json() as User;
}

const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider currentUserFactory={currentUserFactory}>
                {children}
            </AuthProvider>
        </QueryClientProvider>
    );
}