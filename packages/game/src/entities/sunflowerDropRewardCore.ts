import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export const SUNFLOWER_DROP_MIN_GROUND_DISTANCE = 0.55;
export const SUNFLOWER_DROP_MAX_GROUND_DISTANCE = 0.77;
export const SUNFLOWER_DROP_GROUND_Y_OFFSET = 0.085;
export const SUNFLOWER_DROP_PARTICLE_Y_OFFSET = 0.12;

export type SunflowerDropPlacement = {
    block: Block;
    stack: Stack;
};

export type SunflowerDropPosition = {
    particlePosition: Vector3;
    phase: number;
    position: [number, number, number];
    rotation: [number, number, number];
};

function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
    }
    return hash / 100_000;
}

export function findSunflowerDropPlacement(
    stacks: Stack[],
    sourceBlockId: string,
): SunflowerDropPlacement | null {
    for (const stack of stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === sourceBlockId,
        );
        if (block) {
            return { block, stack };
        }
    }

    return null;
}

export function getSunflowerDropPosition({
    placement,
    spawnId,
    stackHeight,
}: {
    placement: SunflowerDropPlacement;
    spawnId: string;
    stackHeight: number;
}): SunflowerDropPosition {
    const angle = hashString(spawnId) * Math.PI * 2;
    const radius =
        SUNFLOWER_DROP_MIN_GROUND_DISTANCE +
        hashString(`${spawnId}:radius`) *
            (SUNFLOWER_DROP_MAX_GROUND_DISTANCE -
                SUNFLOWER_DROP_MIN_GROUND_DISTANCE);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const worldX = placement.stack.position.x + x;
    const worldZ = placement.stack.position.z + z;

    return {
        particlePosition: new Vector3(
            worldX,
            stackHeight + SUNFLOWER_DROP_PARTICLE_Y_OFFSET,
            worldZ,
        ),
        phase: hashString(`${spawnId}:phase`) * Math.PI * 2,
        position: [
            worldX,
            stackHeight + SUNFLOWER_DROP_GROUND_Y_OFFSET,
            worldZ,
        ],
        rotation: [-Math.PI / 2, 0, angle + Math.PI * 0.15],
    };
}
