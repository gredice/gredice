import { directoriesClient } from '@gredice/client';
import { cache } from 'react';
import { isPlantRecommended } from '../../../../packages/js/src/plants/isPlantRecommended';

export const getPlantsData = cache(async () => {
    try {
        const { data, error } =
            await directoriesClient().GET('/entities/plant');

        if (error) {
            console.error('Failed to fetch plants data', error);
            return [];
        }

        return (
            data?.map((plant) => ({
                ...plant,
                isRecommended: isPlantRecommended(plant),
            })) ?? []
        );
    } catch (error) {
        console.error('Failed to fetch plants data', error);
        return [];
    }
});
