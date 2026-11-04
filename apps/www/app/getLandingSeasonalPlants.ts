import { cache } from 'react';
import { getPlantsData } from '../lib/plants/getPlantsData';
import {
    compareCataloguePlantNames,
    toPlantCatalogue,
} from './biljke/plantCatalogue';
import {
    isPlantAvailableInStore,
    rankSowablePlants,
} from './biljke/plantSeason';

const featuredPlantsCount = 4;
const previewPlantsCount = 12;

/**
 * Plants the landing page leads with: the ones a visitor can sow this month
 * (closing windows first), falling back to recommended plants off-season.
 */
export const getLandingSeasonalPlants = cache(async () => {
    try {
        const currentMonth = new Date().getMonth() + 1;
        const catalogue = toPlantCatalogue(await getPlantsData(), []);
        const sowable = rankSowablePlants(
            catalogue,
            currentMonth,
            compareCataloguePlantNames,
        ).filter(isPlantAvailableInStore);
        // Quiet months have only a plant or two to sow; top the grid up with
        // recommended plants that can still be ordered.
        const fillers = catalogue
            .filter(
                (plant) =>
                    isPlantAvailableInStore(plant) &&
                    !sowable.some((entry) => entry.id === plant.id),
            )
            .toSorted(
                (first, second) =>
                    Number(second.isRecommended) - Number(first.isRecommended),
            );
        const plants = [...sowable, ...fillers].slice(0, featuredPlantsCount);
        const previewPlants = catalogue
            .filter((plant) => !plants.some((entry) => entry.id === plant.id))
            .slice(0, previewPlantsCount);

        return {
            currentMonth,
            isSeasonal: sowable.length > 0,
            sowablePlants: sowable.slice(0, featuredPlantsCount),
            plants,
            previewPlants,
            totalPlants: catalogue.length,
        };
    } catch (error) {
        console.error('Failed to load landing seasonal plants', error);
        return null;
    }
});
