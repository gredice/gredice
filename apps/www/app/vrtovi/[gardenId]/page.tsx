import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';
import { PublicGardenExplorer } from '../PublicGardenExplorer';
import { getPublicGardenForWww } from '../publicGardenData';
import { getPublicGardenOgImageUrl } from '../publicGardenUrls';

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

    return (
        <Stack spacing={4} className="py-6">
            <PageHeader
                header={garden.name}
                subHeader="Prošetaj među gredicama, biljkama i malim vrtnim detaljima iz ovog zelenog kutka."
            />
            <Stack spacing={1}>
                <PublicGardenExplorer garden={garden} />
                <Typography
                    level="body3"
                    className="px-1 italic text-muted-foreground"
                >
                    Prikaz je samo za gledanje.
                </Typography>
            </Stack>
        </Stack>
    );
}
