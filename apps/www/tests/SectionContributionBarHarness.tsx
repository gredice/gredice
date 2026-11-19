import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import {
    PageContributors,
    type PageContributorsProps,
} from '../components/community-edits/PageContributors';
import {
    SectionContributionBar,
    type SectionContributionBarProps,
} from '../components/community-edits/SectionContributionBar';
import { currentUserQueryKey } from '../hooks/useCurrentUser';

/** Mounts the bar and the page panel the way a directory page renders them. */
export function SectionContributionBarHarness({
    bar,
    page,
}: {
    bar?: SectionContributionBarProps;
    page?: PageContributorsProps;
}) {
    const [queryClient] = useState(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        client.setQueryData(currentUserQueryKey, null);
        return client;
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" forcedTheme="light">
                <main className="bg-background p-4">
                    <h1 className="text-2xl font-semibold">Rajčica</h1>
                    <p className="my-4">Sadržaj odjeljka.</p>
                    {bar ? <SectionContributionBar {...bar} /> : null}
                    {page ? (
                        <PageContributors {...page} className="mt-6" />
                    ) : null}
                    <a href="#kraj" className="mt-6 inline-block">
                        Sljedeća poveznica
                    </a>
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
