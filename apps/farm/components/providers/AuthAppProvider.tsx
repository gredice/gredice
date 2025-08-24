'use client';

import { AuthProvider } from '@signalco/auth-client/components';
import type { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
};

async function currentUserFactory() {
    const response = await fetch('/api/users/current');
    if (response.status < 200 || response.status > 299) {
        return null;
    }

    return (await response.json()) as User;
}

export function AuthAppProvider({ children }: PropsWithChildren) {
    return (
        <AuthProvider currentUserFactory={currentUserFactory}>
            {children}
        </AuthProvider>
    );
}
