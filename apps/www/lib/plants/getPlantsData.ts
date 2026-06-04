import { directoriesClient, type PlantData } from '@gredice/client';
import { cache } from 'react';
import { isPlantRecommended } from '../../../../packages/js/src/plants/isPlantRecommended';
import type { PlantHealthSource } from './plantRuntimeFields';

export type PlantDataWithRuntimeFields = PlantData & PlantHealthSource;

function includeRuntimePlantFields(
    plant: PlantData,
): PlantDataWithRuntimeFields {
    return plant;
}

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
                ...includeRuntimePlantFields(plant),
                isRecommended: isPlantRecommended(plant),
            })) ?? []
        );
    } catch (error) {
        console.error('Failed to fetch plants data', error);
        return [];
    }
});
