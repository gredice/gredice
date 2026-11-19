import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { MySuggestionsView } from '../app/moji-prijedlozi/MySuggestionsView';

export function MySuggestionsHarness() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" forcedTheme="light">
                <main className="mx-auto max-w-5xl p-4">
                    <h1>Moji prijedlozi</h1>
                    <MySuggestionsView />
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
