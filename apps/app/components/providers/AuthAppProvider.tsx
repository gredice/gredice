'use client';

import { AuthProvider } from '@signalco/auth-client/components';
import type { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
};

async function currentUserFactory() {
    const response = await fetch('/api/users/current', {
        cache: 'no-store',
    });
    if (response.ok) {
        return (await response.json()) as User;
    }

    if (response.status === 401) {
        // Refresh token flow sets the session cookie on 401; retry once.
        const retryResponse = await fetch('/api/users/current', {
            cache: 'no-store',
        });
        if (retryResponse.ok) {
            return (await retryResponse.json()) as User;
        }
    }

    return null;
}

export function AuthAppProvider({ children }: PropsWithChildren) {
    return (
        <AuthProvider currentUserFactory={currentUserFactory}>
            {children}
        </AuthProvider>
    );
}
