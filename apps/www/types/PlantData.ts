import type { PlantData as BaseRemotePlantData } from '@gredice/client';

// Extended plant data with additional information fields
export type PlantData = BaseRemotePlantData & {
    information: BaseRemotePlantData['information'] & {
        // Additional information fields for each stage
        sowingAdditional?: string;
        soilPreparationAdditional?: string;
        plantingAdditional?: string;
        growthAdditional?: string;
        maintenanceAdditional?: string;
        wateringAdditional?: string;
        floweringAdditional?: string;
        harvestAdditional?: string;
        storageAdditional?: string;
    };
};

// Helper type for the information section IDs with additional information
export type InformationSectionWithAdditional = {
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
    available: boolean;
    additionalContent?: string;
};
