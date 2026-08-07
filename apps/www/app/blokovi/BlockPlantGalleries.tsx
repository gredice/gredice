'use client';

import type { BlockData, PlantData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { BlockGallery } from './BlockGallery';
import { PlantBlockGalleryResults } from './PlantBlockGallery';
import { plantMatchesBlockSearch } from './plantBlockSearch';

export function BlockPlantGalleries({
    blocks,
    plants,
}: {
    blocks: BlockData[] | undefined;
    plants: PlantData[] | undefined;
}) {
    const [search] = useClientSearchParam('pretraga');
    const normalizedSearch = normalizeSearchText(search);
    const hasMatchingPlant = (plants ?? []).some((plant) =>
        plantMatchesBlockSearch(plant, normalizedSearch),
    );

    return (
        <>
            <BlockGallery
                blocks={blocks}
                hasMatchingPlant={hasMatchingPlant}
                normalizedSearch={normalizedSearch}
            />
            <Stack spacing={4} className="mt-8">
                <Typography level="h3" className="px-2">
                    Biljke
                </Typography>
                <PlantBlockGalleryResults
                    plants={plants}
                    normalizedSearch={normalizedSearch}
                />
            </Stack>
        </>
    );
}
