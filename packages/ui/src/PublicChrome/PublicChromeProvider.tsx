'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from './currentUser';
import { PublicEnvironmentProvider } from './PublicEnvironmentProvider';
import { WinterModeContext } from './WinterModeContext';

const publicChromeQueryClient = new QueryClient();
const WINTER_MODE_STORAGE_KEY = 'gredice-winter-mode';

// Check if current date is within winter season (Dec 1 - Mar 20)
export function isWinterSeason(date: Date = new Date()): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    if (month === 11 && day >= 1) return true;
    if (month === 0) return true;
    if (month === 1) return true;
    if (month === 2 && day <= 20) return true;

    return false;
}

// Check if current date is within Christmas holidays (Dec 1 - Jan 10)
export function isChristmasHolidaySeason(date: Date = new Date()): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    if (month === 11 && day >= 1) return true;
    if (month === 0 && day <= 10) return true;

    return false;
}

function WinterModeProvider({
    apiBasePath,
    children,
}: {
    apiBasePath: string;
    children: ReactNode;
}) {
    const [isWinter, setIsWinter] = useState<boolean | null>(null);
    const { data: user, isLoading } = useCurrentUser(apiBasePath);

    useEffect(() => {
        const stored = localStorage.getItem(WINTER_MODE_STORAGE_KEY);
        const initialValue =
            stored !== null ? stored === 'true' : isWinterSeason();
        setIsWinter(initialValue);
    }, []);

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (user || !isWinterSeason()) {
            setIsWinter(false);
            localStorage.setItem(WINTER_MODE_STORAGE_KEY, 'false');
        }
    }, [isLoading, user]);

    const toggle = useCallback(() => {
        if (user || !isWinterSeason()) {
            return;
        }

        setIsWinter((previous) => {
            const nextValue = !previous;
            localStorage.setItem(WINTER_MODE_STORAGE_KEY, String(nextValue));
            return nextValue;
        });
    }, [user]);

    return (
        <WinterModeContext.Provider value={{ isWinter, toggle }}>
            {children}
        </WinterModeContext.Provider>
    );
}

export function PublicChromeProvider({
    apiBasePath = '/api/gredice',
    children,
    environmentDebugApiPath = '/api/public-environment/debug',
}: {
    apiBasePath?: string;
    children: ReactNode;
    environmentDebugApiPath?: string;
}) {
    return (
        <QueryClientProvider client={publicChromeQueryClient}>
            <ThemeProvider attribute="class" disableTransitionOnChange>
                <WinterModeProvider apiBasePath={apiBasePath}>
                    <PublicEnvironmentProvider
                        apiBasePath={apiBasePath}
                        debugApiPath={environmentDebugApiPath}
                    >
                        {children}
                    </PublicEnvironmentProvider>
                </WinterModeProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
