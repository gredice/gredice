import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ComponentProps } from 'react';
import { OperationSuggestionCard } from '../app/radnje/OperationSuggestionCard';

export function OperationSuggestionCardHarness(
    props: ComponentProps<typeof OperationSuggestionCard>,
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <div className="grid w-[420px] grid-cols-1 gap-2 p-4">
                    <OperationSuggestionCard {...props} />
                </div>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
