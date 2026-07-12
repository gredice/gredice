import {
    directoriesClient,
    type PlantData,
    type PlantSortData,
} from '@gredice/client';
import { cache } from 'react';

export type PlantSortDataWithRelationships = PlantSortData & {
    prices?: PlantData['prices'];
    relationships?: PlantData['relationships'];
};

export type { PlantSortData };

function includeRuntimeRelationships(
    sort: PlantSortData,
): PlantSortDataWithRelationships {
    return sort;
}

const getPlantSortsDataUncached = async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/plantSort',
        );

        if (error) {
            console.error('Failed to fetch plant sorts data', error);
            return [];
        }

        return data?.map(includeRuntimeRelationships) ?? [];
    } catch (error) {
        console.error('Failed to fetch plant sorts data', error);
        return [];
    }
};

export const getPlantSortsData = cache(getPlantSortsDataUncached);
