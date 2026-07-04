import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InlineLoginDialog } from '../components/auth/InlineLoginDialog';

export function InlineLoginDialogHarness() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <InlineLoginDialog
                description="Prijavi se za nastavak."
                onOpenChange={() => undefined}
                open
            />
        </QueryClientProvider>
    );
}
