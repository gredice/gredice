'use client';

import { Button } from '@gredice/ui/Button';
import { Gallery } from '@gredice/ui/Gallery';
import { GameSeedlingIcon } from '@gredice/ui/GameIcons';
import { PublicEmptyState } from '../../components/shared/placeholders/PublicEmptyState';
import { matchingPlantAlternativeName } from '../../lib/plants/plantSearch';
import { PlantsGalleryItem } from './PlantsGalleryItem';
import { filterPlantArchive } from './plantArchiveFilter';
import {
    matchingCatalogueSortName,
    type PlantCatalogueItem,
} from './plantCatalogue';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

export function PlantsGallery({
    filters,
    plants,
}: {
    filters: PlantArchiveFilterDefaults;
    plants: PlantCatalogueItem[];
}) {
    const { activity, clearFilters, month, search } =
        usePlantArchiveFilters(filters);
    const { filtered, normalizedSearch } = filterPlantArchive(plants, {
        activity,
        month,
        search,
    });
    const items = filtered.map((plant) => ({
        ...plant,
        id: plant.id.toString(),
        currentMonth: filters.currentMonth,
        matchingAlternativeName: matchingPlantAlternativeName(
            plant,
            normalizedSearch,
        ),
        matchingSortName: matchingCatalogueSortName(plant, normalizedSearch),
    }));

    return (
        <>
            {items.length === 0 && (
                <div className="flex flex-col items-center gap-2 pb-6">
                    <PublicEmptyState icon={GameSeedlingIcon}>
                        {month
                            ? 'Nema biljaka za ovaj odabir.'
                            : 'Nema rezultata pretrage.'}
                    </PublicEmptyState>
                    <Button variant="outlined" onClick={clearFilters}>
                        Očisti filtere
                    </Button>
                </div>
            )}
            <Gallery
                gridHeader=""
                items={items}
                itemComponent={PlantsGalleryItem}
            />
        </>
    );
}
