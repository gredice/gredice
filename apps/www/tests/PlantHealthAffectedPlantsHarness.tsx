import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ComponentProps, useState } from 'react';
import { PlantHealthAffectedPlants } from '../components/plant-health/PlantHealthAffectedPlants';

export function PlantHealthAffectedPlantsHarness(
    props: ComponentProps<typeof PlantHealthAffectedPlants>,
) {
    const [queryClient] = useState(
        () =>
            new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" forcedTheme="light">
                <main className="bg-background p-4">
                    <div className="max-w-sm">
                        <PlantHealthAffectedPlants {...props} />
                    </div>
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
