'use client';

import { orderBy } from '@gredice/js/arrays';
import { Gallery } from '@gredice/ui/Gallery';
import { GameSeedlingIcon } from '@gredice/ui/GameIcons';
import { PublicEmptyState } from '../../components/shared/placeholders/PublicEmptyState';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { matchingPlantAlternativeName } from '../../lib/plants/plantSearch';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { PlantsGalleryItem } from './PlantsGalleryItem';
import {
    cataloguePlantMatchesSearch,
    matchingCatalogueSortName,
    type PlantCatalogueItem,
} from './plantCatalogue';

export function PlantsGallery({
    initialSearch = '',
    initialSeedTimeFilter = '',
    plants,
}: {
    initialSearch?: string;
    initialSeedTimeFilter?: string;
    plants: PlantCatalogueItem[];
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const [seedTimeFilter] = useClientSearchParam(
        'vrijemeZaSijanje',
        initialSeedTimeFilter,
    );
    const normalizedSearch = normalizeSearchText(search);
    const onlySeedTimePlants = seedTimeFilter === '1';
    const filteredPlants = orderBy(plants ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    )
        .filter((plant) => !onlySeedTimePlants || plant.isRecommended)
        .filter((plant) => cataloguePlantMatchesSearch(plant, normalizedSearch))
        .map((plant) => {
            const matchingSortName = matchingCatalogueSortName(
                plant,
                normalizedSearch,
            );
            return {
                ...plant,
                id: plant.id.toString(),
                matchingAlternativeName: matchingPlantAlternativeName(
                    plant,
                    normalizedSearch,
                ),
                matchingSortName,
            };
        });

    return (
        <>
            {filteredPlants.length === 0 && (
                <PublicEmptyState icon={GameSeedlingIcon}>
                    Nema rezultata pretrage.
                </PublicEmptyState>
            )}
            <Gallery
                gridHeader=""
                items={filteredPlants}
                itemComponent={PlantsGalleryItem}
            />
        </>
    );
}
