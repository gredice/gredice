import { directoriesClient, type PlantSortData } from '@gredice/client';
import { cache } from 'react';

export type { PlantSortData };

const getPlantSortsDataUncached = async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/plantSort',
        );

        if (error) {
            console.error('Failed to fetch plant sorts data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch plant sorts data', error);
        return [];
    }
};

export const getPlantSortsData = cache(getPlantSortsDataUncached);
