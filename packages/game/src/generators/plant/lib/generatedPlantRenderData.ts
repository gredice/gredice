import { buildDevelopmentalPlantRenderData } from '../developmental/buildDevelopmentalPlantRenderData';
import {
    buildDevelopmentalPlantGraph,
    type DevelopmentalPlantGraph,
} from '../developmental/developmentalPlantGraph';
import type { PlantDefinition } from './plant-definitions';
import type { PlantRenderData } from './plantRenderData';

interface GeneratePlantTopologyOptions {
    generation: number;
    plantDefinition: PlantDefinition;
    seed: string;
}

interface BuildGeneratedPlantRenderDataOptions {
    flowerGrowth: number;
    fruitGrowth: number;
    plantDefinition: PlantDefinition;
    renderDetailedGeometry: boolean;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
    topology: DevelopmentalPlantGraph;
}

export function generatePlantTopology({
    generation,
    plantDefinition,
    seed,
}: GeneratePlantTopologyOptions) {
    return buildDevelopmentalPlantGraph({
        generation,
        plantDefinition,
        seed,
    });
}

export function buildGeneratedPlantRenderData({
    flowerGrowth,
    fruitGrowth,
    plantDefinition,
    renderDetailedGeometry,
    showFlowers,
    showLeaves,
    showProduce,
    topology,
}: BuildGeneratedPlantRenderDataOptions): PlantRenderData {
    return buildDevelopmentalPlantRenderData({
        flowerGrowth,
        fruitGrowth,
        graph: topology,
        plantDefinition,
        renderDetailedGeometry,
        showFlowers,
        showLeaves,
        showProduce,
    });
}
