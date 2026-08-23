import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantTips } from '../app/biljke/[alias]/PlantTips';

export function PlantTipsHarness(props: Parameters<typeof PlantTips>[0]) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <PlantTips {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
