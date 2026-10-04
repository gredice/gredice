import type { Vector3 } from 'three';
import type { Block } from './Block';

export type GardenPosition = {
    x: number;
    y: number;
    z: number;
};

export type GardenStack = {
    position: GardenPosition;
    blocks: Block[];
};

export type Stack = {
    position: Vector3;
    blocks: Block[];
};

export function createGardenPosition(
    x: number,
    y: number,
    z: number,
): GardenPosition {
    return { x, y, z };
}
