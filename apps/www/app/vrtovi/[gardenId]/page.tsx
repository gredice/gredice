import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';
import { PublicGardenViewerDynamic } from '../PublicGardenViewerDynamic';
import { getPublicGardenForWww } from '../publicGardenData';

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
    const title = `${garden.name} - javni vrt`;
    const description = `Readonly prikaz javnog Gredice vrta ${garden.name}.`;
    const path = KnownPages.PublicGarden(garden.id);

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

    return (
        <Stack spacing={6} className="py-8">
            <PageHeader
                padded
                header={garden.name}
                subHeader="Javni prikaz vrta. Možeš istraživati gredice, biljke i planirane radnje bez uređivanja."
            />
            <div className="h-[min(76vh,760px)] min-h-[520px] overflow-hidden rounded-md border border-black/10 bg-background">
                <PublicGardenViewerDynamic className="h-full" garden={garden} />
            </div>
            <Typography level="body2" className="px-2 text-muted-foreground">
                Prikaz je samo za gledanje.
            </Typography>
        </Stack>
    );
}
