import { currentAccountKeys } from '@packages/game/hooks/useCurrentAccount';
import { SunflowersList } from '@packages/game/shared-ui/sunflowers/SunflowersList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { sunflowerVisualHistory } from './sunflowerEconomyFixtures';

export function SunflowerHistoryExamples() {
    const [client] = useState(() => {
        const cache = new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: Infinity,
                    retry: false,
                    refetchOnWindowFocus: false,
                },
            },
        });
        cache.setQueryData(currentAccountKeys, {
            id: 'storybook-account',
            sunflowers: { amount: 100000, history: sunflowerVisualHistory },
        });
        return cache;
    });
    return (
        <section aria-label="Aktivnosti suncokreta" className="space-y-4">
            <h2 className="text-xl font-semibold">Zarada i trošenje</h2>
            <div className="rounded-xl border bg-card p-2">
                <QueryClientProvider client={client}>
                    <SunflowersList pendingSunflowers={1990} />
                </QueryClientProvider>
            </div>
        </section>
    );
}
