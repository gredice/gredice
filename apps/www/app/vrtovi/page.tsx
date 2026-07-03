import { Card } from '@gredice/ui/Card';
import { Calendar, Sprout } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Image from 'next/image';
import { KnownPages } from '../../src/KnownPages';
import { PublicGardenLikeButton } from './PublicGardenLikeButton';
import { PublicGardenTransitionLink } from './PublicGardenTransitionLink';
import { getPublicGardensForWww } from './publicGardenData';
import { formatGardenDate, formatGardenNumber } from './publicGardenFormatting';
import { getPublicGardenOgImageUrl } from './publicGardenUrls';
import { getPublicGardenCardViewTransitionName } from './publicGardenViewTransition';

const pageDescription =
    'Pregledaj Gredice vrtove koje su vlasnici učinili vidljivima i zaviri u biljke, gredice i planirane radnje.';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Vidljivi vrtovi',
    description: pageDescription,
    alternates: {
        canonical: KnownPages.PublicGardens,
    },
    openGraph: {
        title: 'Vidljivi vrtovi',
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
                header="Vidljivi vrtovi"
                subHeader={pageDescription}
            />
            {gardens.items.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gardens.items.map((garden, gardenIndex) => (
                        <Card
                            key={garden.id}
                            className="public-garden-card-view-transition group relative h-full overflow-hidden p-0 transition-shadow hover:shadow-sm"
                            style={{
                                viewTransitionName:
                                    getPublicGardenCardViewTransitionName(
                                        garden.id,
                                    ),
                            }}
                        >
                            <PublicGardenTransitionLink
                                href={KnownPages.PublicGarden(garden.id)}
                                className="absolute inset-0 z-10 rounded-lg"
                                ariaLabel={`Otvori vrt ${garden.name}`}
                            >
                                <span className="sr-only">
                                    Otvori vrt {garden.name}
                                </span>
                            </PublicGardenTransitionLink>
                            <div className="relative h-full text-card-foreground">
                                <div className="overflow-hidden bg-muted">
                                    <Image
                                        src={getPublicGardenOgImageUrl(
                                            garden.id,
                                        )}
                                        alt={`Prikaz vrta ${garden.name}`}
                                        width={1200}
                                        height={630}
                                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                        priority={gardenIndex === 0}
                                        className="aspect-[1200/630] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    />
                                </div>
                                <div className="grid grid-cols-3 divide-x border-t bg-card">
                                    <div className="flex items-center gap-2 px-3 py-3">
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
                                                {formatGardenDate(
                                                    garden.createdAt,
                                                )}
                                            </Typography>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-3">
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
                                                {formatGardenNumber(
                                                    garden.activePlantCount,
                                                )}
                                            </Typography>
                                        </div>
                                    </div>
                                    <PublicGardenLikeButton
                                        gardenId={garden.id}
                                        initialLikeCount={garden.likeCount}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Typography level="body1" className="px-2">
                    Trenutno nema vidljivih vrtova.
                </Typography>
            )}
        </Stack>
    );
}
