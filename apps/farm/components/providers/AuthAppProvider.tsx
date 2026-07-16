'use client';

import { AuthProvider } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';
import {
    type FarmOperationCompletionSyncMode,
    isFarmOperationCompletionSyncMode,
} from '../../lib/offline/operationCompletionSyncMode';

export type User = {
    accountId: string;
    accounts: { accountId: string }[];
    id: string;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
    role: 'admin' | 'farmer';
    operationCompletionSyncMode: FarmOperationCompletionSyncMode;
    sessionIncarnation: string;
    createdAt?: string;
};

function isAccount(value: unknown): value is { accountId: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'accountId' in value &&
        typeof value.accountId === 'string'
    );
}

export function isFarmCurrentUser(value: unknown): value is User {
    return (
        typeof value === 'object' &&
        value !== null &&
        'accountId' in value &&
        typeof value.accountId === 'string' &&
        'accounts' in value &&
        Array.isArray(value.accounts) &&
        value.accounts.every(isAccount) &&
        'id' in value &&
        typeof value.id === 'string' &&
        'operationCompletionSyncMode' in value &&
        isFarmOperationCompletionSyncMode(value.operationCompletionSyncMode) &&
        'role' in value &&
        (value.role === 'admin' || value.role === 'farmer') &&
        'sessionIncarnation' in value &&
        typeof value.sessionIncarnation === 'string' &&
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
