import {
    NavUserButton,
    type PublicChromeLinkMode,
    PublicChromeProvider,
    WinterModeContext,
} from '@gredice/ui/PublicChrome';
import { LandingFeaturedGardens } from '../app/LandingFeaturedGardens';
import type { LandingGardenCandidate } from '../app/landingGardenCarousel';

export function AvatarProfileLinksHarness({
    featuredGardens,
    linkMode,
}: {
    featuredGardens: LandingGardenCandidate[];
    linkMode?: PublicChromeLinkMode;
}) {
    return (
        <PublicChromeProvider>
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
        </PublicChromeProvider>
    );
}
