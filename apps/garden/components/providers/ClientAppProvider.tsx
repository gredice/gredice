'use client';

import { useThemeManager } from '@gredice/game';
import { AuthProvider } from '@gredice/ui/auth';
import { NotificationsContainer } from '@gredice/ui/notifications';
import { NuqsAdapter } from '@gredice/ui/nuqs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';

function DayNightThemeSync() {
    useThemeManager();
    return null;
}

export type User = {
    id: string;
    isTemporary: boolean;
    userName: string;
};

async function currentUserFactory() {
    const response = await fetch('/api/gredice/api/auth/current-claims', {
        cache: 'no-store',
    });
    if (!response.ok) {
        console.warn('Failed to fetch current user claims:', response.status);
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
                    <DayNightThemeSync />
                    <AuthProvider currentUserFactory={currentUserFactory}>
                        {children}
                        <NotificationsContainer />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
