import type * as THREE from 'three';
import type { PlantDefinition } from './plant-definition-types';
import type { VegetableData } from './vegetableRenderMetadata';

export interface PlantStemSegment {
    endRadius: number;
    matrix: THREE.Matrix4;
    startRadius: number;
}

export interface PlantLodSummary {
    accentCenterY: number;
    accentColor?: string;
    canopyCenterY: number;
    canopyWidth: number;
    dominantColor: string;
    foliageColor: string;
    hasFoliage: boolean;
    height: number;
    stemColor: string;
    stemWidth: number;
}

export interface PlantRenderData {
    flowers: THREE.Matrix4[];
    leafColors: THREE.Color[];
    leaves: THREE.Matrix4[];
    lodSummary: PlantLodSummary;
    stemSegments: PlantStemSegment[];
    thorns: THREE.Matrix4[];
    vegetables: VegetableData[];
}

export function getApproximatePlantHeight(plantDefinition: PlantDefinition) {
    return Math.max(
        plantDefinition.height * 1.35,
        plantDefinition.leaf.size * 4,
        plantDefinition.vegetable.baseSize * 3.2,
        0.3,
    );
}
