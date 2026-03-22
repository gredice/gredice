'use client';

import type { PlantData } from '@gredice/client';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { orderBy } from '@signalco/js';
import { Gallery } from '@signalco/ui/Gallery';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { KnownPages } from '../../src/KnownPages';
import { plantNamesWithLSystem } from './plantNamesWithLSystem';

function PlantBlockGalleryItem(props: Omit<PlantData, 'id'> & { id: string }) {
    return (
        <ItemCard
            label={
                <Row spacing={1} justifyContent="center">
                    <Typography>{props.information.name}</Typography>
                </Row>
            }
            href={KnownPages.BlockPlant(props.information.name)}
        >
            <PlantOrSortImage
                plant={props}
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
    const [search] = useSearchParam('pretraga');
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) =>
            plantNamesWithLSystem.has(plant.information.name.toLowerCase()),
        )
        .filter(
            (plant) =>
                !search ||
                plant.information.name
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        )
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
