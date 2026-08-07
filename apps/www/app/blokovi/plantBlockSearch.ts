import type { PlantData } from '@gredice/client';
import { plantMatchesSearch } from '../../lib/plants/plantSearch';
import { plantNamesWithProceduralModels } from './plantNamesWithProceduralModels';

export function plantMatchesBlockSearch(
    plant: PlantData,
    normalizedSearch: string,
) {
    return (
        plantNamesWithProceduralModels.has(
            plant.information.name.toLowerCase(),
        ) && plantMatchesSearch(plant, normalizedSearch)
    );
}
