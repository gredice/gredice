import { client } from '@gredice/client';
import { CountingNumber } from '@gredice/ui/CountingNumber';
import type { SectionData } from '@signalco/cms-core/SectionData';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { Suspense } from 'react';
import DeliveryTruck from '../assets/DeliveryTruck.webp';
import RaisedBedMaintenance from '../assets/RaisedBedMaintenance.webp';
import SeedsAndTransplants from '../assets/SeedsAndTransplants.webp';
import { sectionsComponentRegistry } from '../components/shared/sectionsComponentRegistry';
import { FacebookCard } from '../components/social/FacebookCard';
import { InstagramCard } from '../components/social/InstagramCard';
import { WhatsAppCard } from '../components/social/WhatsAppCard';
import { KnownPages } from '../src/KnownPages';
import { LandingGameScene } from './LandingGameScene';
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
        <div className="rounded-2xl border border-tertiary border-b-4 bg-white p-6 grid grid-rows-[auto_auto_1fr] h-full">
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
            <div className="rounded-2xl border border-tertiary border-b-4 bg-white p-6 h-[182px] animate-pulse" />
            <div className="rounded-2xl border border-tertiary border-b-4 bg-white p-6 h-[182px] animate-pulse" />
            <div className="rounded-2xl border border-tertiary border-b-4 bg-white p-6 h-[182px] animate-pulse" />
        </div>
    );
}

async function PlantsStatistics() {
    const response = await client().api.data.statistics.plants.$get();
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
}

function StepsSection() {
    return (
        <Stack spacing={4} className="mb-20">
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
                        <Stack spacing={2}>
                            <Stack spacing={2}>
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
                                    Mi postavljamo gredice kod lokalnog OPG-a i
                                    brzo sadimo tvoje biljke.
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
                        <Stack spacing={2}>
                            <Stack spacing={2}>
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
                        <Stack spacing={2}>
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
            <div className="relative">
                <div className="relative h-[100dvh] lg:h-[700px] -mt-16 w-full overflow-hidden">
                    <Image
                        alt="Tvoj novi vrt u Gredice aplikaciji"
                        className="absolute inset-0 h-full w-full object-contain opacity-0 pointer-events-none"
                        height={1080}
                        src="/seo-fallback.png"
                        width={1920}
                    />
                    <LandingGameScene />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
                </div>
                <Container className="absolute top-0 left-0 right-0">
                    <Card className="w-fit mt-4 border-tertiary border-b-4">
                        <CardContent noHeader className="p-6 lg:pr-10">
                            <Stack spacing={2}>
                                <Typography level="h2">
                                    Vrt po tvom 🌱
                                </Typography>
                                <Typography level="body1">
                                    Dobiješ povrće iz svojih gredica - nit oro,
                                    nit kopo!
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                </Container>
            </div>
            <Container>
                <SectionsView
                    sectionsData={sectionsData}
                    componentsRegistry={sectionsComponentRegistry}
                />
                <StepsSection />
                <Stack spacing={4}>
                    <Stack spacing={1}>
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
                <Stack spacing={4} className="mt-20">
                    <Stack spacing={1}>
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
                        <div className="bg-white border border-tertiary border-b-4 shadow p-6 rounded-xl lg:col-start-2 lg:row-start-1 lg:row-span-3">
                            <NewsletterSignUp />
                        </div>
                    </div>
                </Stack>
            </Container>
        </Stack>
    );
}
