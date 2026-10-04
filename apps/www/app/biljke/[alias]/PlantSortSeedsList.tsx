import type { SeedData } from '@gredice/client';
import { slug } from '@gredice/js/slug';
import { GalleryGrid } from '@gredice/ui/Gallery';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { getSeedsData } from '../../../lib/seeds/getSeedsData';
import { SeedCard } from '../../sjeme/SeedCard';
import { selectSeedsForPlantSort } from './plantSortSeeds';

function PlantSortSeedCard({ seed }: { id: string; seed: SeedData }) {
    return <SeedCard seed={seed} />;
}

async function PlantSortSeedsListContent({
    plantSortId,
}: {
    plantSortId: number;
}) {
    const seeds = selectSeedsForPlantSort(await getSeedsData(), plantSortId);

    if (seeds.length === 0) {
        return null;
    }

    const items = seeds.map((seed) => ({
        id: seed.id.toString(),
        seed,
    }));
    const headingId = slug('Sjeme');

    return (
        <section aria-labelledby={headingId}>
            <Stack spacing={4}>
                <Typography level="h2" className="text-2xl" id={headingId}>
                    Sjeme
                </Typography>
                <GalleryGrid items={items} itemComponent={PlantSortSeedCard} />
            </Stack>
        </section>
    );
}

export function PlantSortSeedsList({ plantSortId }: { plantSortId: number }) {
    return (
        <Suspense
            fallback={
                <Typography level="body2">Učitavanje sjemena...</Typography>
            }
        >
            <PlantSortSeedsListContent plantSortId={plantSortId} />
        </Suspense>
    );
}
