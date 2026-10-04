import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ProfilePageClient } from '../app/korisnici/[publicId]/ProfilePageClient';

export function PublicProfileHarness() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { retry: false, staleTime: Infinity },
                },
            }),
    );
    return (
        <QueryClientProvider client={queryClient}>
            <main className="mx-auto max-w-5xl p-6">
                <ProfilePageClient publicId="test-profile" />
            </main>
        </QueryClientProvider>
    );
}
