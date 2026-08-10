import { cache } from 'react';
import { isPlantRecommended } from '../../../../packages/js/src/plants/isPlantRecommended';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getPlantsData = cache(async () => {
    const data = await getDirectoryEntitiesData('plant');
    return data.map((plant) => ({
        ...plant,
        isRecommended: isPlantRecommended(plant),
    }));
});
