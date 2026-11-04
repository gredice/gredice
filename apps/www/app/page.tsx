import { Container } from '@gredice/ui/Container';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { RelatedFaq } from '../components/faq/RelatedFaq';
import { LandingHeroCopy } from '../components/landing/LandingHeroCopy';
import { LandingHowItWorks } from '../components/landing/LandingHowItWorks';
import { LandingPricing } from '../components/landing/LandingPricing';
import { LandingProofStrip } from '../components/landing/LandingProofStrip';
import { LandingResponsibilities } from '../components/landing/LandingResponsibilities';
import { LandingSeasonalPlants } from '../components/landing/LandingSeasonalPlants';
import { CtaBand } from '../components/shared/CtaBand';
import { FacebookCard } from '../components/social/FacebookCard';
import { InstagramCard } from '../components/social/InstagramCard';
import { WhatsAppCard } from '../components/social/WhatsAppCard';
import { WinterModeToggle } from '../components/WinterModeToggle';
import { KnownPages } from '../src/KnownPages';
import { getLandingFeaturedGardens } from './getLandingFeaturedGardens';
import { LandingFeaturedGardens } from './LandingFeaturedGardens';
import { LandingGameScene } from './LandingGameScene';
import { NewsletterSignUp } from './NewsletterSignUp';
import { OutletLandingSection } from './outlet/OutletLandingSection';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    alternates: {
        canonical: KnownPages.Landing,
    },
};

export default async function Home() {
    const featuredGardens = await getLandingFeaturedGardens();
    const showFeaturedGardens = featuredGardens.length > 0;

    return (
        <Stack>
            <div className="relative pb-4">
                <Container
                    maxWidth="xl"
                    className="relative px-2 sm:px-4 [--landing-card-radius:calc(var(--landing-frame-radius)*0.625)] [--landing-frame-radius:1.5rem] md:[--landing-frame-radius:2rem]"
                >
                    <div className="grid items-center gap-8 pt-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pt-6">
                        <LandingHeroCopy />
                        <div
                            className="relative h-[min(540px,calc(100dvh-18rem))] min-h-[420px] w-full overflow-hidden rounded-[var(--landing-frame-radius)] border border-tertiary/70 bg-muted shadow-2xl shadow-foreground/10 md:h-[min(600px,calc(100dvh-12rem))] lg:h-[min(660px,calc(100dvh-8rem))] lg:min-h-[520px]"
                            data-testid="landing-game-frame"
                        >
                            <Image
                                alt="Tvoj novi vrt u Gredice aplikaciji"
                                className="absolute inset-0 h-full w-full object-contain opacity-0 pointer-events-none"
                                height={1080}
                                src="/seo-fallback.png"
                                width={1920}
                            />
                            {showFeaturedGardens ? (
                                <LandingFeaturedGardens
                                    featuredGardens={featuredGardens}
                                />
                            ) : (
                                <>
                                    <LandingGameScene />
                                    <div className="pointer-events-auto absolute top-4 right-4 z-10 md:top-6 md:right-6">
                                        <WinterModeToggle />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </Container>
            </div>
            <Container>
                <div className="mt-6 sm:mt-10">
                    <Suspense
                        fallback={
                            <div className="h-[118px] animate-pulse rounded-2xl border border-tertiary border-b-4 bg-card" />
                        }
                    >
                        <LandingProofStrip />
                    </Suspense>
                </div>
                <LandingHowItWorks />
                <LandingResponsibilities />
                <LandingSeasonalPlants />
                <Suspense fallback={null}>
                    <OutletLandingSection />
                </Suspense>
                <LandingPricing />
                <RelatedFaq placement="home" layout="split" />
                <CtaBand
                    id="landing-final-cta-title"
                    title="Tvoja gredica čeka. Složi je u par klikova."
                    description="Odaberi povrće danas, a mi se pobrinemo za sve ostalo."
                    className="my-14 sm:my-20"
                />
                <Stack spacing={8}>
                    <Stack spacing={2}>
                        <Typography level="body1" semiBold tertiary>
                            Zajednica za svakoga
                        </Typography>
                        <Typography level="h2">
                            Pridruži se našim zajednicama
                        </Typography>
                    </Stack>
                    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 mb-10 grid-rows-3">
                        <WhatsAppCard />
                        <InstagramCard />
                        <FacebookCard />
                        <div className="bg-card border border-tertiary border-b-4 shadow p-6 rounded-xl lg:col-start-2 lg:row-start-1 lg:row-span-3">
                            <NewsletterSignUp />
                        </div>
                    </div>
                </Stack>
            </Container>
        </Stack>
    );
}
