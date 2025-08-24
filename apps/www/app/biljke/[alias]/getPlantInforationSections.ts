import type { PlantData } from '@gredice/client';

export type InformationSection = {
    header: string;
    id:
        | 'sowing'
        | 'soilPreparation'
        | 'planting'
        | 'growth'
        | 'maintenance'
        | 'watering'
        | 'flowering'
        | 'harvest'
        | 'storage';
    avaialble: boolean;
};

export function getPlantInforationSections(
    plant: PlantData,
): InformationSection[] {
    return [
        {
            header: 'Sijanje',
            id: 'sowing',
            avaialble: Boolean(plant.information.sowing),
        },
        {
            header: 'Priprema tla',
            id: 'soilPreparation',
            avaialble: Boolean(plant.information.soilPreparation),
        },
        {
            header: 'Sadnja',
            id: 'planting',
            avaialble: Boolean(plant.information.planting),
        },
        {
            header: 'Rast',
            id: 'growth',
            avaialble: Boolean(plant.information.growth),
        },
        {
            header: 'Održavanje',
            id: 'maintenance',
            avaialble: Boolean(plant.information.maintenance),
        },
        {
            header: 'Zalijevanje',
            id: 'watering',
            avaialble: Boolean(plant.information.watering),
        },
        {
            header: 'Cvjetanje',
            id: 'flowering',
            avaialble: Boolean(plant.information.flowering),
        },
        {
            header: 'Berba',
            id: 'harvest',
            avaialble: Boolean(plant.information.harvest),
        },
        {
            header: 'Skladištenje',
            id: 'storage',
            avaialble: Boolean(plant.information.storage),
        },
    ];
}
