'use client';

import { AuthProvider } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';

async function currentUserFactory() {
    const response = await fetch('/api/users/current-claims', {
        cache: 'no-store',
    });
    return response.ok ? await response.json() : null;
}

export function AuthAppProvider({ children }: PropsWithChildren) {
    return (
        <AuthProvider currentUserFactory={currentUserFactory}>
            {children}
        </AuthProvider>
    );
}
