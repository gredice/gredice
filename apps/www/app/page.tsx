import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Navigate } from "@signalco/ui-icons";
import { KnownPages } from "../src/KnownPages";
import { SectionData } from "@signalco/cms-core/SectionData";
import { getFlags } from "../lib/flags/getFlags";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NewsletterSignUp } from "./NewsletterSignUp";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { BlocksIcon } from "lucide-react";
import { EntityViewer } from "@gredice/game";
import { BlockImage } from "../components/blocks/BlockImage";

const sectionsData: SectionData[] = [
    {
        component: 'Heading1',
        tagline: 'Gredice',
        header: 'Vrt po tvom',
        description: 'Dobiješ povrćeg iz svojih gredica - nit oro, nit kopo!',
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameSceneDynamic
                    appBaseUrl="https://vrt.gredice.com"
                    freezeTime={new Date(2024, 5, 21, 14)}
                    noBackground
                    hideHud />
            </div>
        ),
        ctas: [
            { label: 'Posjeti svoj vrt', href: KnownPages.GardenApp, icon: <Navigate /> }
        ]
    },
    {
        component: 'Feature1',
        tagline: 'Expertise on Demand',
        header: 'Workers Marketplace',
        description: 'Hire expert workers to help you with your projects. From software development to personal trainers and chefs, we have you covered.',
        features: [
            {
                header: `heading`,
                description: 'Experts available to help you with your projects',
                asset: <BlockImage blockName="Raised_Bed" width={128} height={128} />
            },
            {
                // asset: <DemoMarketplace />,
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
                <Typography>Dobiješ povrćeg iz svojih gredica - nit oro, nit kopo!</Typography>
                <NewsletterSignUp />
            </Stack>
        ),
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameSceneDynamic
                    appBaseUrl="https://vrt.gredice.com"
                    freezeTime={new Date(2024, 5, 21, 14)}
                    noBackground
                    hideHud />
            </div>
        ),
        ctas: [

        ]
    }
];

export default async function Home() {
    const flags = await getFlags();
    const preSeason = flags.preSeason({ fallback: true });

    return (
        <SectionsView
            sectionsData={preSeason ? preSeasonSectionsData : sectionsData}
            componentsRegistry={sectionsComponentRegistry} />
    );
}
