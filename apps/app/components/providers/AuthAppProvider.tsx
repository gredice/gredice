'use client';

import { AuthProvider } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
};

async function currentUserFactory() {
    const response = await fetch('/api/users/current-claims', {
        cache: 'no-store',
    });
    if (response.ok) {
        return (await response.json()) as User;
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
