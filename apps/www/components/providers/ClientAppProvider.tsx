'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { WinterModeProvider } from './WinterModeProvider';

export const queryClient = new QueryClient();

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <WinterModeProvider>{children}</WinterModeProvider>
        </QueryClientProvider>
    );
}
