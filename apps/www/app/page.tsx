import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Navigate } from "@signalco/ui-icons";
import { KnownPages } from "../src/KnownPages";
import { SectionData } from "@signalco/cms-core/SectionData";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NewsletterSignUp } from "./NewsletterSignUp";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { BlockImage } from "../components/blocks/BlockImage";

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
        description: 'Zasadi, održavaj i uberi. Mi ćemo ti pomoći u svakom koraku i dostaviti ti svježe povrće iz tvojih gredica.',
        features: [
            {
                header: 'Zasadi',
                description: 'Odaberi svoju kombinaciju povrća i zasadi svoje gredice. Mi postavljamo pravu gredicu na polju jednog od naših partnera i sadimo ili sijemo tvoje povrće.',
                asset: <BlockImage blockName="Raised_Bed" width={128} height={128} />
            },
            {
                header: 'Održavaj',
                description: 'Prati stanje svojih gredica i brini se o svojim biljkama. Mi ćemo ti slati obavijesti i savjete kako bi tvoje povrće bilo zdravo i ukusno.',
                asset: <BlockImage blockName="Bucket" width={128} height={128} />
            },
            {
                header: 'Uberi',
                description: 'Uberi svoje povrće kad hod želiš. Mi ćemo ti pomoći u berbi i dostaviti ti svježe povrće na kućnu adresu.',
                asset: <BlockImage blockName="Shade" width={128} height={128} />
            }
        ]
    }
];

const preSeasonSectionsData: SectionData[] = [
    {
        component: 'Heading1',
        tagline: 'Gredice',
        header: 'Vrt po tvom',
        description: (
            <Stack spacing={6}>
                <Typography>Dobiješ povrće iz svojih gredica - nit oro, nit kopo!</Typography>
                <NewsletterSignUp />
            </Stack>
        ),
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameSceneDynamic
                    appBaseUrl="https://vrt.gredice.com"
                    freezeTime={new Date(2024, 5, 21, 11, 30)}
                    noBackground
                    hideHud
                    noWeather
                    noSound
                    mockGarden />
            </div>
        ),
        ctas: [

        ]
    }
];

export default async function Home() {
    // const flags = await getFlags();
    const preSeason = true;//flags.preSeason({ fallback: true });

    return (
        <SectionsView
            sectionsData={preSeason ? preSeasonSectionsData : sectionsData}
            componentsRegistry={sectionsComponentRegistry} />
    );
}
