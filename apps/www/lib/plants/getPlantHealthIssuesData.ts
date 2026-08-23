import type { PlantDiseaseData, PlantPestData } from '@gredice/directory-types';
import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export type { PlantDiseaseData, PlantPestData };
export type PlantHealthIssueData = PlantDiseaseData | PlantPestData;

export const getPlantDiseasesData = cache(() =>
    getDirectoryEntitiesData('plantDisease'),
);

export const getPlantPestsData = cache(() =>
    getDirectoryEntitiesData('plantPest'),
);
