import { clientPublic } from '@gredice/client';
import { Card, CardContent } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { CountingNumber } from '@gredice/ui/CountingNumber';
import type { SectionData } from '@gredice/ui/cms';
import { SectionsView } from '@gredice/ui/cms';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { Suspense } from 'react';
import DeliveryTruck from '../assets/DeliveryTruck.webp';
import RaisedBedMaintenance from '../assets/RaisedBedMaintenance.webp';
import SeedsAndTransplants from '../assets/SeedsAndTransplants.webp';
import { sectionsComponentRegistry } from '../components/shared/sectionsComponentRegistry';
import { FacebookCard } from '../components/social/FacebookCard';
import { InstagramCard } from '../components/social/InstagramCard';
import { WhatsAppCard } from '../components/social/WhatsAppCard';
import { WinterModeToggle } from '../components/WinterModeToggle';
import { KnownPages } from '../src/KnownPages';
import { LandingGameScene, LandingGameSignupCta } from './LandingGameScene';
import { NewsletterSignUp } from './NewsletterSignUp';
import { PlantsShowcase } from './PlantsShowcase';

const sectionsData: SectionData[] = [
    {
        component: 'Feature1',
        tagline: 'Vrt po tvom',
        header: 'Klikneš, mi sadimo - ti uživaš',
        description:
            'Par klikova i tvoje gredice su spremne! Odaberi povrće, mi ga posadimo, a ti ubrzo uživaš u plodovima svog novog vrta.',
    },
];

function PlantsStatisticsCard({
    header,
    subheader,
    value,
}: {
    header: string;
    subheader: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-6 grid grid-rows-[auto_auto_1fr] h-full">
            <CountingNumber
                className="mb-4 text-5xl font-mono"
                number={parseInt(value, 10)}
                inView
            >
                {value}
            </CountingNumber>
            <Typography level="h5">{header}</Typography>
            <Typography level="body2" secondary>
                {subheader}
            </Typography>
        </div>
    );
}

function PlantsStatisticsLoading() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-6 h-[182px] animate-pulse" />
            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-6 h-[182px] animate-pulse" />
            <div className="rounded-2xl border border-tertiary border-b-4 bg-card p-6 h-[182px] animate-pulse" />
        </div>
    );
}

async function PlantsStatistics() {
    try {
        const response = await clientPublic().api.data.statistics.plants.$get();
        if (!response || response.status !== 200) {
            return null;
        }

        const { totalPlants, totalPlantSorts, totalPlantedPlants } =
            await response.json();

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PlantsStatisticsCard
                    header="Dostupnih biljaka"
                    subheader="Informacije o biljkama, sve na jednom mjestu"
                    value={totalPlants.toString()}
                />
                <PlantsStatisticsCard
                    header="Dostupnih sorti"
                    subheader="Sorte biljaka koje možeš posaditi u svoje gredice"
                    value={totalPlantSorts.toString()}
                />
                <PlantsStatisticsCard
                    header="Posađenih biljaka"
                    subheader="Do sada posađenih biljaka u svim vrtovima naših korisnika"
                    value={totalPlantedPlants.toString()}
                />
            </div>
        );
    } catch (error) {
        console.error('Failed to fetch plants statistics', error);
        return null;
    }
}

function StepsSection() {
    return (
        <Stack spacing={8} className="mb-20">
            <div className="lg:flex lg:items-center lg:gap-8">
                <Image
                    alt="Sjeme i presadnice"
                    className="w-32 sm:w-[200px]"
                    src={SeedsAndTransplants}
                    width={200}
                    height={200}
                />
                <Card className="border-tertiary border-b-4 lg:max-w-[40%]">
                    <CardContent noHeader>
                        <Stack spacing={4}>
                            <Stack spacing={4}>
                                <Typography level="h4" component="h3">
                                    Zasadi
                                </Typography>
                                <Typography
                                    level="body1"
                                    className="text-pretty"
                                >
                                    Odaberi svoju kombinaciju povrća u
                                    aplikaciji i složi svoju gredicu.
                                </Typography>
                                <Typography
                                    level="body1"
                                    className="text-pretty"
                                >
                                    Mi postavljamo tvoju gredicu kod lokalnog
                                    OPG-a i brzo sadimo tvoje biljke.
                                </Typography>
                            </Stack>
                            <NavigatingButton
                                variant="link"
                                className="w-fit"
                                href={KnownPages.RaisedBeds}
                            >
                                Više o podignutim gredicama
                            </NavigatingButton>
                        </Stack>
                    </CardContent>
                </Card>
            </div>
            <div className="flex flex-col-reverse lg:flex-row lg:justify-end lg:items-center lg:gap-8">
                <Card className="border-tertiary border-b-4  lg:max-w-[40%]">
                    <CardContent noHeader>
                        <Stack spacing={4}>
                            <Stack spacing={4}>
                                <Typography level="h4" component="h3">
                                    Održavaj
                                </Typography>
                                <Typography
                                    level="body1"
                                    className="text-pretty"
                                >
                                    Prati stanje svojih gredica, naruči
                                    zalijevanje, okopavanje ili što god treba
                                    tvom vrtu.
                                </Typography>
                                <Typography
                                    level="body1"
                                    className="text-pretty"
                                >
                                    U aplikaciji ćeš dobivati obavijesti, slike
                                    svojih gredica i savjete kako bi tvoje
                                    biljke bile sretne i zdrave.
                                </Typography>
                            </Stack>
                            <NavigatingButton
                                variant="link"
                                className="w-fit"
                                href={KnownPages.Operations}
                            >
                                Više o radnjama
                            </NavigatingButton>
                        </Stack>
                    </CardContent>
                </Card>
                <Image
                    alt="Održavanje gredice"
                    className="w-32 sm:w-[200px]"
                    src={RaisedBedMaintenance}
                    width={200}
                    height={200}
                />
            </div>
            <div className="lg:flex lg:items-center lg:gap-8">
                <Image
                    alt="Dostava povrća"
                    className="w-32 sm:w-[200px]"
                    src={DeliveryTruck}
                    width={200}
                    height={200}
                />
                <Card className="border-tertiary border-b-4  lg:max-w-[40%]">
                    <CardContent noHeader>
                        <Stack spacing={4}>
                            <Typography level="h4" component="h3">
                                Uberi i uživaj
                            </Typography>
                            <Typography level="body1" className="text-pretty">
                                Kad poželiš, klikni za branje svog povrća.
                            </Typography>
                            <Stack>
                                <Typography
                                    level="body1"
                                    className="text-pretty"
                                >
                                    Mi ćemo ubrati sve plodove tvojih gredica i
                                    dostaviti ih još svježe iz tvog vrta
                                    direktno na tvoj kućni prag.
                                </Typography>
                                <Typography level="body3">
                                    * Besplatna dostava je dostupna za područje
                                    Zagreba
                                </Typography>
                            </Stack>
                            <NavigatingButton
                                variant="link"
                                className="w-fit"
                                href={KnownPages.Delivery}
                            >
                                Više o dostavi
                            </NavigatingButton>
                        </Stack>
                    </CardContent>
                </Card>
            </div>
        </Stack>
    );
}

export default function Home() {
    return (
        <Stack>
            <div className="relative pt-3 pb-4 md:pt-6">
                <Container
                    maxWidth="xl"
                    className="relative px-2 sm:px-4 [--landing-card-radius:calc(var(--landing-frame-radius)*0.625)] [--landing-frame-radius:1.5rem] md:[--landing-frame-radius:2rem]"
                >
                    <div
                        className="relative h-[min(540px,calc(100dvh-18rem))] min-h-[420px] w-full overflow-hidden rounded-[var(--landing-frame-radius)] border border-tertiary/70 bg-muted shadow-2xl shadow-foreground/10 md:h-[calc(100dvh-9rem)] md:max-h-[720px] lg:min-h-[560px]"
                        data-testid="landing-game-frame"
                    >
                        <Image
                            alt="Tvoj novi vrt u Gredice aplikaciji"
                            className="absolute inset-0 h-full w-full object-contain opacity-0 pointer-events-none"
                            height={1080}
                            src="/seo-fallback.png"
                            width={1920}
                        />
                        <LandingGameScene />
                    </div>
                    <LandingGameSignupCta />
                    <div className="pointer-events-none absolute left-8 right-8 top-8 z-10 sm:left-10 sm:right-10 md:top-10 lg:left-16 lg:right-16 lg:top-12">
                        <div className="pointer-events-auto flex flex-col items-start sm:flex-row sm:items-start sm:justify-between gap-4">
                            <Card
                                className="w-fit max-w-[19rem] rounded-[var(--landing-card-radius)] border-tertiary border-b-4 sm:max-w-none"
                                data-testid="landing-hero-card"
                            >
                                <CardContent
                                    noHeader
                                    className="p-5 sm:p-6 lg:pr-10"
                                >
                                    <Stack spacing={4}>
                                        <Typography level="h2" component="h1">
                                            Vrt po tvom 🌱
                                        </Typography>
                                        <Typography level="body1">
                                            Dobiješ povrće iz svojih gredica -
                                            nit oro, nit kopo!
                                        </Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                            <WinterModeToggle />
                        </div>
                    </div>
                </Container>
            </div>
            <Container>
                <SectionsView
                    sectionsData={sectionsData}
                    componentsRegistry={sectionsComponentRegistry}
                />
                <StepsSection />
                <Stack spacing={8}>
                    <Stack spacing={2}>
                        <Typography level="body1" semiBold tertiary>
                            Povrće iz tvog vrta
                        </Typography>
                        <Typography level="h2">
                            Koje povrće možeš posaditi?
                        </Typography>
                    </Stack>
                    <Typography level="body1" className="text-balance max-w-lg">
                        Naša ponuda povrća je raznolika i prilagođena tvojim
                        potrebama. Odaberi svoje omiljeno povrće, začine i
                        cvijeće te zasadi svoje gredice.
                    </Typography>
                    <Suspense fallback={<PlantsStatisticsLoading />}>
                        <PlantsStatistics />
                    </Suspense>
                    <PlantsShowcase />
                </Stack>
                <Stack spacing={8} className="mt-20">
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
