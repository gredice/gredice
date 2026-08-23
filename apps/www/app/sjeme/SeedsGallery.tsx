'use client';

import type { SeedData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { Gallery } from '@gredice/ui/Gallery';
import { Typography } from '@gredice/ui/Typography';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { SeedCard } from './SeedCard';
import { seedCountLabel, seedMatchesSearch } from './seedPresentation';

function SeedGalleryItem({ seed }: { id: string; seed: SeedData }) {
    return <SeedCard seed={seed} />;
}

export function SeedsGallery({
    seeds,
    initialSearch = '',
}: {
    seeds: SeedData[];
    initialSearch?: string;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const filteredSeeds = orderBy(seeds, (left, right) =>
        left.information.name.localeCompare(right.information.name, 'hr-HR'),
    ).filter((seed) => seedMatchesSearch(seed, search));
    const items = filteredSeeds.map((seed) => ({
        id: seed.id.toString(),
        seed,
    }));

    return (
        <div className="space-y-4">
            <Typography
                level="body2"
                secondary
                aria-live="polite"
                className="sr-only"
            >
                {seedCountLabel(filteredSeeds.length)}
            </Typography>
            {filteredSeeds.length === 0 ? (
                <Typography level="body2" className="py-8 text-center">
                    Nema rezultata pretrage.
                </Typography>
            ) : (
                <Gallery
                    gridHeader=""
                    items={items}
                    itemComponent={SeedGalleryItem}
                />
            )}
        </div>
    );
}
