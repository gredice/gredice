import type { Vector3 } from 'three';

type PositionInput = Pick<Vector3, 'x' | 'z'>;

const BASE_DELAY_MS = 120;
const BASE_HEIGHT = 10;
const HEIGHT_INCREMENT = 0.65;

export function getStackRingDistance(position: PositionInput): number {
    return Math.max(Math.abs(position.x), Math.abs(position.z));
}

export function getStackEntranceDelay(position: PositionInput): number {
    return getStackRingDistance(position) * BASE_DELAY_MS;
}

export function getStackEntranceHeight(ringDistance: number): number {
    return BASE_HEIGHT + ringDistance * HEIGHT_INCREMENT;
}
