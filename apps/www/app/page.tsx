import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Check, CompanyFacebook, Navigate } from "@signalco/ui-icons";
import { KnownPages } from "../src/KnownPages";
import { SectionData } from "@signalco/cms-core/SectionData";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NewsletterSignUp } from "./NewsletterSignUp";
import { GameSceneDynamic } from "./GameSceneDynamic";
import SeedsAndTransplants from '../assets/SeedsAndTransplants.webp';
import RaisedBedMaintenance from '../assets/RaisedBedMaintenance.webp';
import DeliveryTruck from '../assets/DeliveryTruck.webp';
import Image from "next/image";
import { Row } from "@signalco/ui-primitives/Row";
import { PlantsShowcase } from "./PlantsShowcase";
import WhatsAppCard from "../components/social/WhatsAppCard";
import { CompanyInstagram } from "./Footer";

const sectionsData: SectionData[] = [
    {
        component: 'Heading1',
        tagline: 'Gredice',
        header: 'Vrt po tvom',
        description: 'Dobiješ povrće iz svojih gredica - nit oro, nit kopo!',
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameSceneDynamic
                    appBaseUrl="https://vrt.gredice.com"
                    freezeTime={new Date(2024, 5, 21, 11, 30)}
                    noBackground
                    hideHud
                    noControls
                    noWeather
                    noSound
                    mockGarden />
            </div>
        ),
        ctas: [
            { label: 'Posjeti svoj vrt', href: KnownPages.GardenApp, icon: <Navigate /> }
        ]
    },
    {
        component: 'Feature1',
        tagline: 'Vrt po tvom',
        header: 'Par koraka do svježeg povrća',
        description: 'Zasadi, održavaj i uberi. Pomoći ćemo ti u svakom koraku i na kraju ti dostaviti svježe povrće iz tvojih gredica.',
        asset: (
            <div className="h-full items-center flex flex-row mb-8 -mt-4">
                <Stack spacing={4}>
                    <Row spacing={2}>
                        <Check className="size-5" />
                        <Stack>
                            <Typography level="h6" component="span">Samo tvoj vrt</Typography>
                            <Typography level="body2" secondary>Tvoja gredica - tvoje povrće</Typography>
                        </Stack>
                    </Row>
                    <Row spacing={2}>
                        <Check className="size-5" />
                        <Stack>
                            <Typography level="h6" component="span">Nema pretplate</Typography>
                            <Typography level="body1" secondary>Plaćaš samo ono što zasadiš, odradiš ili kupiš</Typography>
                        </Stack>
                    </Row>
                    <Row spacing={2}>
                        <Check className="size-5" />
                        <Stack>
                            <Typography level="h6" component="span">Besplatna dostava</Typography>
                            <Typography level="body1" secondary>Prva berba svake biljke uključuje besplatnu dostavu</Typography>
                            <Typography level="body3">* Besplatna dostava je dostupna samo za područje Zagreba</Typography>
                        </Stack>
                    </Row>
                </Stack>
            </div>
        ),
        features: [
            {
                asset: (
                    <Row spacing={4}>
                        <Image alt="Sjeme i presadnice" className="w-32 sm:w-[200px]" src={SeedsAndTransplants} width={200} height={200} />
                        <Stack spacing={2}>
                            <Typography level="h4" component="h3">Zasadi</Typography>
                            <Typography level="body1" className="text-balance">Odaberi svoju kombinaciju povrća i zasadi ih u gredice. Mi postavljamo gredice kod jednog od naših partnera i sadimo tvoje biljke.</Typography>
                        </Stack>
                    </Row>
                )
            },
            {
                asset: (
                    <Row spacing={4}>
                        <Stack spacing={2}>
                            <Typography level="h4" component="h3">Održavaj</Typography>
                            <Typography level="body1" className="text-balance">Prati stanje svojih gredica i brini se o svojim biljkama. Dobit ćeš obavijesti i savjete kako bi tvoje biljke bile sretne i zdrave.</Typography>
                        </Stack>
                        <Image alt="Održavanje gredice" className="w-32 sm:w-[200px]" src={RaisedBedMaintenance} width={200} height={200} />
                    </Row>
                )
            },
            {
                asset: (
                    <Row spacing={4}>
                        <Image alt="Dostava povrća" className="w-32 sm:w-[200px]" src={DeliveryTruck} width={200} height={200} />
                        <Stack spacing={2}>
                            <Typography level="h4" component="h3">Uberi i uživaj</Typography>
                            <Stack>
                                <Typography level="body1" className="text-balance">Zatraži branje svog povrća kad god želiš. Mi beremo i dostavljamo još svježe na kućni prag.</Typography>
                                <Typography level="body3">* Besplatna dostava je dostupna samo za područje Zagreba</Typography>
                            </Stack>
                        </Stack>
                    </Row>
                )
            }
        ]
    }
];

export default function Home() {
    return (
        <Stack>
            <SectionsView
                sectionsData={sectionsData}
                componentsRegistry={sectionsComponentRegistry} />
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography level="body1" semiBold tertiary>Povrće iz tvog vrta</Typography>
                    <Typography level="h2">Koje povrće možeš posaditi?</Typography>
                </Stack>
                <Typography level="body1" className="text-balance max-w-lg">
                    Naša ponuda povrća je raznolika i prilagođena tvojim potrebama. Odaberi svoje omiljeno povrće, začine i cvijeće i zasadi svoje gredice.
                </Typography>
                <PlantsShowcase />
            </Stack>
            <Stack spacing={4} className="mt-20">
                <Stack spacing={1}>
                    <Typography level="body1" semiBold tertiary>Zajednica za svakoga</Typography>
                    <Typography level="h2">Pridruži se našim zajednicama</Typography>
                </Stack>
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 mb-10">
                    <div className="mx-auto">
                        <WhatsAppCard />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4">
                        <div className="bg-white border shadow p-6 rounded-xl lg:col-span-2">
                            <NewsletterSignUp />
                        </div>
                        <a href="https://gredice.link/ig" className="bg-white border shadow p-4 rounded-xl flex items-center justify-center hover:bg-[#833ab4]/10 transition-colors">
                            <CompanyInstagram className="size-40 rounded-[50px] p-4 fill-white bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]" />
                        </a>
                        <a href="https://gredice.link/fb" className="bg-white border shadow p-4 rounded-xl flex items-center justify-center hover:bg-[#1877F2]/10 transition-colors">
                            <CompanyFacebook className="size-48 rounded-[50px] p-4 fill-[#1877F2]" />
                        </a>
                    </div>
                </div>
            </Stack>
        </Stack>
    );
}
