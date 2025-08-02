'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';

export const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    );
}