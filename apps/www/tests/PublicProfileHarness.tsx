import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { PublicProfileView } from '../app/korisnici/[publicId]/PublicProfileView';
import type { PublicProfileData } from '../app/korisnici/[publicId]/publicProfileData';

/** Mounts the profile the way the server page renders it: with loaded data. */
export function PublicProfileHarness({
    profile,
}: {
    profile: PublicProfileData;
}) {
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
                <PublicProfileView profile={profile} />
            </main>
        </QueryClientProvider>
    );
}
