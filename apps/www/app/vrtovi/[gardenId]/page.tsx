import { Card } from '@gredice/ui/Card';
import { Calendar, Sprout } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';
import { PublicGardenExplorer } from '../PublicGardenExplorer';
import { getPublicGardenForWww } from '../publicGardenData';
import {
    countActivePlantsFromPublicGarden,
    formatGardenDate,
    formatGardenNumber,
} from '../publicGardenFormatting';
import { getPublicGardenOgImageUrl } from '../publicGardenUrls';
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
    const ogImageUrl = getPublicGardenOgImageUrl(garden.id);

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
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `Prikaz vrta ${garden.name}`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
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

    const garden = await getPublicGardenForWww(gardenId);
    const activePlantCount = countActivePlantsFromPublicGarden(garden);

    return (
        <Stack spacing={2} className="py-6">
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
                    <div className="grid grid-cols-2 divide-x border-t bg-card">
                        <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
                            <Calendar
                                aria-hidden
                                className="size-4 shrink-0 text-primary"
                            />
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Stvoren
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="truncate font-medium"
                                >
                                    {formatGardenDate(garden.createdAt)}
                                </Typography>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
                            <Sprout
                                aria-hidden
                                className="size-4 shrink-0 text-primary"
                            />
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Biljaka
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="truncate font-medium"
                                >
                                    {formatGardenNumber(activePlantCount)}
                                </Typography>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
            <Typography
                level="body3"
                className="px-1 italic text-muted-foreground"
            >
                Prikaz je samo za gledanje.
            </Typography>
        </Stack>
    );
}
