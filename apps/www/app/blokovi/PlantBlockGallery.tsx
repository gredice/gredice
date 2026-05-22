'use client';

import type { PlantData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { Gallery } from '@gredice/ui/Gallery';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { plantMatchesSearch } from '../../lib/plants/plantSearch';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { KnownPages } from '../../src/KnownPages';
import { PlantBlockImage } from './PlantBlockImage';
import { plantNamesWithLSystem } from './plantNamesWithLSystem';

function PlantBlockGalleryItem(props: Omit<PlantData, 'id'> & { id: string }) {
    return (
        <ItemCard
            label={
                <Row spacing={2} justifyContent="center">
                    <Typography>{props.information.name}</Typography>
                </Row>
            }
            href={KnownPages.BlockPlant(props.information.name)}
        >
            <PlantBlockImage
                plantName={props.information.name}
                fill
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
            />
        </ItemCard>
    );
}

export function PlantBlockGallery({
    plants,
}: {
    plants: PlantData[] | undefined;
}) {
    const [search] = useClientSearchParam('pretraga');
    const normalizedSearch = normalizeSearchText(search);
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) =>
            plantNamesWithLSystem.has(plant.information.name.toLowerCase()),
        )
        .filter((plant) => plantMatchesSearch(plant, normalizedSearch))
        .map((plant) => ({ ...plant, id: plant.id.toString() }));

    if (filteredPlants.length === 0) {
        return null;
    }

    return (
        <Gallery
            gridHeader=""
            items={filteredPlants}
            itemComponent={PlantBlockGalleryItem}
        />
    );
}
