'use client';

import { AuthProvider } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';

export type User = {
    id: string;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
    role: 'admin' | 'farmer';
    createdAt?: string;
};

export function isFarmCurrentUser(value: unknown): value is User {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        typeof value.id === 'string' &&
        'role' in value &&
        (value.role === 'admin' || value.role === 'farmer') &&
        'userName' in value &&
        typeof value.userName === 'string'
    );
}

async function currentUserFactory() {
    const response = await fetch('/api/users/current-claims', {
        cache: 'no-store',
    });
    if (response.ok) {
        const responseBody: unknown = await response.json();
        return isFarmCurrentUser(responseBody) ? responseBody : null;
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
