import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicBreadcrumbs } from '../../../components/shared/seo/PublicBreadcrumbs';
import { KnownPages } from '../../../src/KnownPages';
import { PublicGardenExplorer } from '../PublicGardenExplorer';
import { PublicGardenStatsAccordion } from '../PublicGardenStatsAccordion';
import { PublicGardenSummary } from '../PublicGardenSummary';
import {
    getPublicGardenBlockDataForWww,
    getPublicGardenForWww,
} from '../publicGardenData';
import {
    calculatePublicGardenStats,
    countActivePlantsFromPublicGarden,
} from '../publicGardenFormatting';
import { getPublicGardenCardViewTransitionName } from '../publicGardenViewTransition';

export const dynamic = 'force-dynamic';

function parseGardenId(value: string) {
    const gardenId = Number.parseInt(value, 10);
    return Number.isFinite(gardenId) ? gardenId : null;
}

type PublicGardenPageParams = {
    gardenId: string;
};

export async function generateMetadata({
    params,
}: {
    params: Promise<PublicGardenPageParams>;
}): Promise<Metadata> {
    const { gardenId: rawGardenId } = await params;
    const gardenId = parseGardenId(rawGardenId);
    if (!gardenId) {
        notFound();
    }

    const garden = await getPublicGardenForWww(gardenId);
    const title = garden.name;
    const description = `Zaviri u Gredice vrt ${garden.name}: prošetaj među gredicama, biljkama i malim vrtnim detaljima.`;
    const path = KnownPages.PublicGarden(garden.id);
    const previewImage = garden.previewImage;

    return {
        title,
        description,
        alternates: {
            canonical: path,
        },
        openGraph: {
            title,
            description,
            url: path,
            ...(previewImage
                ? {
                      images: [
                          {
                              url: previewImage.url,
                              width: previewImage.width,
                              height: previewImage.height,
                              alt: `Prikaz vrta ${garden.name}`,
                          },
                      ],
                  }
                : {}),
        },
        twitter: {
            card: previewImage ? 'summary_large_image' : 'summary',
            title,
            description,
            ...(previewImage ? { images: [previewImage.url] } : {}),
        },
    };
}

export default async function PublicGardenPage({
    params,
}: {
    params: Promise<PublicGardenPageParams>;
}) {
    const { gardenId: rawGardenId } = await params;
    const gardenId = parseGardenId(rawGardenId);
    if (!gardenId) {
        notFound();
    }

    const [garden, blockData] = await Promise.all([
        getPublicGardenForWww(gardenId),
        getPublicGardenBlockDataForWww(),
    ]);
    const gardenStats = calculatePublicGardenStats(garden, blockData);

    return (
        <Stack spacing={2} className="py-6">
            <PublicBreadcrumbs
                className="px-1"
                items={[
                    { label: 'Vrtovi', href: KnownPages.PublicGardens },
                    { label: garden.name },
                ]}
            />
            <Card
                className="public-garden-card-view-transition overflow-hidden p-0"
                style={{
                    viewTransitionName: getPublicGardenCardViewTransitionName(
                        garden.id,
                    ),
                }}
            >
                <PublicGardenExplorer
                    framed={false}
                    garden={garden}
                    size="card"
                />
                <div className="border-t bg-card">
                    <div className="space-y-3 px-4 py-4 sm:px-5">
                        <div>
                            <Typography level="h2" component="h1">
                                {garden.name}
                            </Typography>
                            <Typography
                                level="body2"
                                secondary
                                className="mt-2 max-w-2xl text-pretty"
                            >
                                Prošetaj među gredicama, biljkama i malim vrtnim
                                detaljima iz ovog zelenog kutka.
                            </Typography>
                        </div>
                    </div>
                    <PublicGardenSummary
                        garden={garden}
                        activePlantCount={countActivePlantsFromPublicGarden(
                            garden,
                        )}
                    />
                    <PublicGardenStatsAccordion stats={gardenStats} />
                </div>
            </Card>
            <Typography
                level="body3"
                className="px-1 italic text-muted-foreground"
            >
                Tvoj vrtni lik slobodno šeće dok ne odabereš „Prošetaj vrtom”.
                Tijekom posjeta možeš vidjeti i druge posjetitelje uživo.
            </Typography>
        </Stack>
    );
}
