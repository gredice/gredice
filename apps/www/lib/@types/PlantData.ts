import { PlantAttributesData } from "./PlantAttributesData";

export type PlantData = {
    id: number,
    // plantFamily?: PlantFamily,
    information: {
        name: string,
        verified: boolean,
        description?: string | null,
        origin?: string | null,
        latinName?: string | null,
        soilPreparation?: string | null,
        sowing?: string | null,
        planting?: string | null,
        flowering?: string | null,
        maintenance?: string | null,
        growth?: string | null,
        harvest?: string | null,
        storage?: string | null,
        watering?: string | null,
        operations?: string[] | null,
        tip?: { header: string, content: string }[] | null
    },
    image?: { cover?: { url?: string } },
    attributes?: PlantAttributesData,
    calendar?: {
        [key: string]: { start: number, end: number }[]
    },
    prices: {
        perPlant: number,
    }
    // companions?: number[],
    // antagonists?: number[],
    // diseases?: number[],
    // pests?: number[],
};