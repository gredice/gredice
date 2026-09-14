import {
    NavUserButton,
    type PublicChromeLinkMode,
    WinterModeContext,
} from '@gredice/ui/PublicChrome';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { LandingFeaturedGardens } from '../app/LandingFeaturedGardens';
import type { LandingGardenCandidate } from '../app/landingGardenCarousel';

export function AvatarProfileLinksHarness({
    featuredGardens,
    linkMode,
}: {
    featuredGardens: LandingGardenCandidate[];
    linkMode?: PublicChromeLinkMode;
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
            <header className="flex justify-end p-4">
                <NavUserButton
                    href="https://vrt.gredice.com/"
                    linkMode={linkMode}
                />
            </header>
            <WinterModeContext value={{ isWinter: false, toggle: () => {} }}>
                <main className="relative mx-2 h-[560px] overflow-hidden rounded-2xl bg-muted [--landing-card-radius:1.25rem]">
                    <LandingFeaturedGardens featuredGardens={featuredGardens} />
                </main>
            </WinterModeContext>
        </QueryClientProvider>
    );
}
