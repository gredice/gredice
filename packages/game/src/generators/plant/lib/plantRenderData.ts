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
    /**
     * Typical radius of the produce or flowers that show, in plant units:
     * the root-mean-square over organs, counting only the shoulder of a
     * root. The far and mid cards size their produce dots with it.
     */
    accentRadius?: number;
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
