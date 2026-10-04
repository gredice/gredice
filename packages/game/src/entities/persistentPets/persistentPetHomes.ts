export const persistentPetHomeSpecs = {
    RabbitHutch: {
        doorwayOffset: 0.6,
        spanDepth: 1,
        spanWidth: 1,
    },
    HorseStable: {
        doorwayOffset: 0.78,
        spanDepth: 2,
        spanWidth: 2,
    },
    CowShelter: {
        doorwayOffset: 0.75,
        spanDepth: 2,
        spanWidth: 2,
    },
    GoatShelter: {
        doorwayOffset: 0.48,
        spanDepth: 1,
        spanWidth: 1,
    },
    SheepFold: {
        doorwayOffset: 0.7,
        spanDepth: 2,
        spanWidth: 2,
    },
} as const;

export type PersistentPetHomeBlockName = keyof typeof persistentPetHomeSpecs;

export function isPersistentPetHomeBlockName(
    name: string,
): name is PersistentPetHomeBlockName {
    return Object.hasOwn(persistentPetHomeSpecs, name);
}

function normalizedQuarterTurns(rotation: number) {
    return ((Math.round(rotation) % 4) + 4) % 4;
}

export function getPersistentPetHomePlacement({
    blockName,
    rotation,
    x,
    z,
}: {
    blockName: PersistentPetHomeBlockName;
    rotation: number;
    x: number;
    z: number;
}) {
    const spec = persistentPetHomeSpecs[blockName];
    const quarterTurns = normalizedQuarterTurns(rotation);
    const swapsFootprintAxes = quarterTurns % 2 === 1;
    const spanWidth = swapsFootprintAxes ? spec.spanDepth : spec.spanWidth;
    const spanDepth = swapsFootprintAxes ? spec.spanWidth : spec.spanDepth;
    const center = {
        x: x + (spanWidth - 1) / 2,
        z: z + (spanDepth - 1) / 2,
    };
    // Exported Blender +Y (the authored opening) maps to local -Z in Three.
    const facingYaw = quarterTurns * (Math.PI / 2) + Math.PI;
    const doorway = {
        x: center.x + Math.sin(facingYaw) * spec.doorwayOffset,
        z: center.z + Math.cos(facingYaw) * spec.doorwayOffset,
    };

    return { center, doorway, facingYaw, spanDepth, spanWidth };
}

export function createPersistentPetHomeBlockedCells({
    block,
    blockData,
    blockWater = false,
    clearanceCells = 0,
    stack,
    stacks,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    blockWater?: AnimalBlockedCellOptions['blockWater'];
    clearanceCells?: AnimalBlockedCellOptions['clearanceCells'];
    stack: Stack;
    stacks: Stack[] | undefined;
}) {
    const obstacles = createAnimalBlockedCells(stacks, {
        blockData,
        blockWater,
        clearanceCells,
        ignoredBlockIds: [block.id],
    });
    const homeFootprint = createAnimalBlockedCells(
        [
            {
                blocks: [block],
                position: stack.position,
            },
        ],
        { blockData },
    );
    const blockedByKey = new Map(
        [...obstacles, ...homeFootprint].map((cell) => [
            `${cell.x}:${cell.z}`,
            cell,
        ]),
    );
    return [...blockedByKey.values()];
}

import type { BlockData } from '@gredice/client';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type AnimalBlockedCellOptions,
    createAnimalBlockedCells,
} from '../animals/animalMovementTerrain';
