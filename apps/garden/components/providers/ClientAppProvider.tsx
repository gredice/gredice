'use client';

import { useThemeManager } from '@gredice/game/theme';
import { AuthProvider } from '@gredice/ui/auth';
import { NotificationsContainer } from '@gredice/ui/notifications';
import { NuqsAdapter } from '@gredice/ui/nuqs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { markReturningUser } from '../../lib/auth/returningUser';
import { TemporaryAccountLoginModal } from '../auth/TemporaryAccountLoginModal';

function DayNightThemeSync() {
    useThemeManager();
    return null;
}

export type User = {
    id: string;
    isTemporary: boolean;
    userName: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isUser(value: unknown): value is User {
    return (
        isObject(value) &&
        typeof value.id === 'string' &&
        typeof value.isTemporary === 'boolean' &&
        typeof value.userName === 'string'
    );
}

async function currentUserFactory() {
    const response = await fetch('/api/gredice/api/auth/current-claims', {
        cache: 'no-store',
    });
    if (response.status === 401) {
        const unauthorized: unknown = await response.json().catch(() => null);
        if (isObject(unauthorized) && unauthorized.returningUser === true) {
            markReturningUser();
        }
        return null;
    }

    if (!response.ok) {
        console.warn('Failed to fetch current user claims:', response.status);
        return null;
    }

    const user: unknown = await response.json().catch(() => null);
    if (!isUser(user)) {
        console.warn('Received invalid current user claims');
        return null;
    }
    if (!user.isTemporary) {
        markReturningUser();
    }
    return user;
}

const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="light">
                    <DayNightThemeSync />
                    <AuthProvider currentUserFactory={currentUserFactory}>
                        {children}
                        <TemporaryAccountLoginModal />
                        <NotificationsContainer />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
