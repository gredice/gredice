import type { PlantData, PlantSortData } from '@gredice/directory-types';
import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

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
    const data = await getDirectoryEntitiesData('plantSort');
    return data.map(includeRuntimeRelationships);
};

export const getPlantSortsData = cache(getPlantSortsDataUncached);
