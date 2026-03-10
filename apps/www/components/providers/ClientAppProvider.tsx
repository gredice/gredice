'use client';

import { NuqsAdapter } from '@gredice/ui/nuqs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { DayNightThemeSync } from './DayNightThemeSync';
import { WinterModeProvider } from './WinterModeProvider';

export const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <DayNightThemeSync />
                <NuqsAdapter>
                    <WinterModeProvider>{children}</WinterModeProvider>
                </NuqsAdapter>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
