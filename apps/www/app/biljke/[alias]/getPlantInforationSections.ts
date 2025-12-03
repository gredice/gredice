import type { PlantData } from '@gredice/client';
import type { PlantStageName } from '@gredice/game';
import { PLANT_STAGES } from '@gredice/game';

export type InformationSection = {
    header: string;
    id: PlantStageName;
    avaialble: boolean;
};

export function getPlantInforationSections(
    plant: PlantData,
): InformationSection[] {
    return PLANT_STAGES.map((stage) => ({
        header: stage.label,
        id: stage.name,
        avaialble: Boolean(plant.information[stage.name]),
    }));
}
