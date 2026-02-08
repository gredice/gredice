'use client';

import { NuqsAdapter } from '@gredice/ui/nuqs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { WinterModeProvider } from './WinterModeProvider';

export const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class">
                    <WinterModeProvider>{children}</WinterModeProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
