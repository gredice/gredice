import { Card, CardContent } from '@gredice/ui/Card';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { getPublicGardensForWww } from './publicGardenData';

const pageDescription =
    'Pregledaj javne Gredice vrtove i zaviri u biljke, gredice i planirane radnje.';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Javni vrtovi',
    description: pageDescription,
    alternates: {
        canonical: KnownPages.PublicGardens,
    },
    openGraph: {
        title: 'Javni vrtovi',
        description: pageDescription,
        url: KnownPages.PublicGardens,
    },
};

export default async function PublicGardensPage() {
    const gardens = await getPublicGardensForWww();

    return (
        <Stack spacing={8} className="py-8">
            <PageHeader
                padded
                header="Javni vrtovi"
                subHeader={pageDescription}
            />
            {gardens.items.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gardens.items.map((garden) => (
                        <Card key={garden.id} className="h-full rounded-md">
                            <CardContent noHeader>
                                <Stack spacing={3}>
                                    <Typography level="h3">
                                        <Link
                                            href={KnownPages.PublicGarden(
                                                garden.id,
                                            )}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {garden.name}
                                        </Link>
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Javni prikaz vrta s biljkama, gredicama
                                        i aktivnim radnjama.
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Typography level="body1" className="px-2">
                    Trenutno nema javno objavljenih vrtova.
                </Typography>
            )}
        </Stack>
    );
}
