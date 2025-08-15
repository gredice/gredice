import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Check, Navigate } from "@signalco/ui-icons";
import { KnownPages } from "../src/KnownPages";
import { SectionData } from "@signalco/cms-core/SectionData";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NewsletterSignUp } from "./NewsletterSignUp";
import { GameScene } from "@gredice/game";
import SeedsAndTransplants from '../assets/SeedsAndTransplants.webp';
import RaisedBedMaintenance from '../assets/RaisedBedMaintenance.webp';
import DeliveryTruck from '../assets/DeliveryTruck.webp';
import Image from "next/image";
import { Row } from "@signalco/ui-primitives/Row";
import { PlantsShowcase } from "./PlantsShowcase";
import { FacebookCard } from "../components/social/FacebookCard";
import { InstagramCard } from "../components/social/InstagramCard";
import { WhatsAppCard } from "../components/social/WhatsAppCard";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";

const sectionsData: SectionData[] = [
    {
        component: 'Heading1',
        tagline: 'Gredice',
        header: 'Vrt po tvom',
        description: 'Dobiješ povrće iz svojih gredica - nit oro, nit kopo!',
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameScene
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
        header: 'Klikneš, mi sadimo - ti uživaš',
        description: 'Par klikova i tvoje gredice su spremne! Odaberi povrće, mi ga posadimo, a ti ubrzo uživaš u plodovima svog novog vrta.',
        asset: (
            <div className="h-full items-center flex flex-row mb-8 -mt-4">
                <Stack spacing={4}>
                    <Row spacing={2}>
                        <Check className="size-5 shrink-0" />
                        <Stack>
                            <Typography level="h6" component="span">Samo tvoj vrt</Typography>
                            <Typography level="body2" secondary>Tvoja gredica - tvoje povrće</Typography>
                        </Stack>
                    </Row>
                    <Row spacing={2}>
                        <Check className="size-5 shrink-0" />
                        <Stack>
                            <Typography level="h6" component="span">Mi radimo umjesto tebe</Typography>
                            <Typography level="body1" secondary>Sve što klikneš, mi odradimo. Tvoj zadatak je pratiti svoj vrt preko aplikacije i biti maštovit u biranju sljedeće biljke za svoj vrt.</Typography>
                        </Stack>
                    </Row>
                    <Row spacing={2}>
                        <Check className="size-5 shrink-0" />
                        <Stack>
                            <Typography level="h6" component="span">Poželiš plodove - mi dostavljamo</Typography>
                            <Typography level="body1" secondary>Kad poželiš plodove iz svog vrta, mi ih dostavljamo na tvoj kućni prag. Prva dostava za svaku biljku je besplatna.</Typography>
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
                            <Stack spacing={2}>
                                <Typography level="h4" component="h3">Zasadi</Typography>
                                <Typography level="body1" className="text-balance">Odaberi svoju kombinaciju povrća u aplikaciji i složi svoju gredicu.</Typography>
                                <Typography level="body1" className="text-balance">Mi postavljamo gredice kod lokalnog OPG-a i brzo sadimo tvoje biljke.</Typography>
                            </Stack>
                            <NavigatingButton variant="link" className="w-fit" href={KnownPages.RaisedBeds}>
                                Više o podignutim gredicama
                            </NavigatingButton>
                        </Stack>
                    </Row>
                )
            },
            {
                asset: (
                    <Row spacing={4}>
                        <Stack spacing={2}>
                            <Stack spacing={2}>
                                <Typography level="h4" component="h3">Održavaj</Typography>
                                <Typography level="body1" className="text-balance">Prati stanje svojih gredica, naruči zalijevanje, okopavanje ili što god treba tvom vrtu.</Typography>
                                <Typography level="body1" className="text-balance">U aplikaciji ćeš dobivati obavijesti, slike svojih gredica i savjete kako bi tvoje biljke bile sretne i zdrave.</Typography>
                            </Stack>
                            <NavigatingButton variant="link" className="w-fit" href={KnownPages.Operations}>
                                Više o radnjama
                            </NavigatingButton>
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
                            <Typography level="body1" className="text-balance">Kad poželiš, klikni za branje svog povrća.</Typography>
                            <Stack>
                                <Typography level="body1" className="text-balance">Mi ćemo ubrati sve plodove tvojih gredica i dostaviti ih još svježe iz tvog vrta direktno na tvoj kućni prag.</Typography>
                                <Typography level="body3">* Besplatna dostava je dostupna samo za područje Zagreba</Typography>
                            </Stack>
                            <NavigatingButton variant="link" className="w-fit" href={KnownPages.Delivery}>
                                Više o dostavi
                            </NavigatingButton>
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
                    Naša ponuda povrća je raznolika i prilagođena tvojim potrebama. Odaberi svoje omiljeno povrće, začine i cvijeće te zasadi svoje gredice.
                </Typography>
                <PlantsShowcase />
            </Stack>
            <Stack spacing={4} className="mt-20">
                <Stack spacing={1}>
                    <Typography level="body1" semiBold tertiary>Zajednica za svakoga</Typography>
                    <Typography level="h2">Pridruži se našim zajednicama</Typography>
                </Stack>
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 mb-10 grid-rows-3">
                    <WhatsAppCard />
                    <InstagramCard />
                    <FacebookCard />
                    <div className="bg-white border shadow p-6 rounded-xl lg:col-start-2 lg:row-start-1 lg:row-span-3">
                        <NewsletterSignUp />
                    </div>
                </div>
            </Stack>
        </Stack>
    );
}
