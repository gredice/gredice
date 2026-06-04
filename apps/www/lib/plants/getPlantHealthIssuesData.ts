import {
    directoriesClient,
    type PlantDiseaseData,
    type PlantPestData,
} from '@gredice/client';
import { cache } from 'react';

export type { PlantDiseaseData, PlantPestData };
export type PlantHealthIssueData = PlantDiseaseData | PlantPestData;

export const getPlantDiseasesData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/plantDisease',
        );

        if (error) {
            console.error('Failed to fetch plant diseases data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch plant diseases data', error);
        return [];
    }
});

export const getPlantPestsData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/plantPest',
        );

        if (error) {
            console.error('Failed to fetch plant pests data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch plant pests data', error);
        return [];
    }
});
