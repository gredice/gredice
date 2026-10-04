import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    type AnimalMovementSurface,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
    getAnimalMovementYAt,
} from '../animals/animalMovementTerrain';
import { findSquirrelPath, type SquirrelPathCell } from './squirrelPathfinding';
import { hashSquirrelSeed } from './squirrelSpawning';

export type SquirrelTarget = {
    id: string;
    position: Vector3;
};

export type SquirrelHabitat = {
    blockedCells: SquirrelPathCell[];
    escapeTargets: SquirrelTarget[];
    groundSurfaces: AnimalMovementSurface[];
    id: string;
    revisionKey: string;
    roamTargets: SquirrelTarget[];
    seed: number;
    spawnTarget: SquirrelTarget;
    treeBlockName: string;
    treePosition: Vector3;
};

export const squirrelHabitatTreeBlockNames = [
    'Tree',
    'Pine',
    'PineAdvent',
    'DeadTreeTall',
] as const;

const squirrelTreeBlockNameSet = new Set<string>(squirrelHabitatTreeBlockNames);
const squirrelGroundLift = 0.018;
const squirrelHabitatRadiusBlocks = 4;
const squirrelMinimumRoamTargets = 3;
const adjacentTreeOffsets = [
    { x: -1, z: 0 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: 0, z: 1 },
] as const;

function cellKey(position: Pick<Vector3, 'x' | 'z'>) {
    return `${Math.round(position.x)}:${Math.round(position.z)}`;
}

export function isSquirrelHabitatTreeBlockName(name: string) {
    return squirrelTreeBlockNameSet.has(name);
}

function findTreeBlocks(stacks: Stack[] | undefined) {
    const trees: { block: Block; stack: Stack }[] = [];
    for (const stack of stacks ?? []) {
        const topBlock = stack.blocks.at(-1);
        if (topBlock && isSquirrelHabitatTreeBlockName(topBlock.name)) {
            trees.push({ block: topBlock, stack });
        }
    }
    return trees;
}

function createTreeApproachTargets({
    blockedCellKeys,
    groundSurfaces,
    tree,
}: {
    blockedCellKeys: Set<string>;
    groundSurfaces: AnimalMovementSurface[];
    tree: { block: Block; stack: Stack };
}) {
    const targets: SquirrelTarget[] = [];

    for (const offset of adjacentTreeOffsets) {
        const cellCenter = new Vector3(
            tree.stack.position.x + offset.x,
            0,
            tree.stack.position.z + offset.z,
        );
        if (
            blockedCellKeys.has(cellKey(cellCenter)) ||
            getAnimalMovementSurfaceAt(cellCenter, groundSurfaces)?.kind !==
                'ground'
        ) {
            continue;
        }

        const position = cellCenter.clone();
        position.x -= offset.x * 0.32;
        position.z -= offset.z * 0.32;
        position.y = getAnimalMovementYAt(position, groundSurfaces);
        targets.push({
            id: `tree-${tree.block.id}-${offset.x.toString()}-${offset.z.toString()}`,
            position,
        });
    }

    return targets;
}

function createRoamTargets({
    blockedCellKeys,
    groundSurfaces,
    tree,
}: {
    blockedCellKeys: Set<string>;
    groundSurfaces: AnimalMovementSurface[];
    tree: { block: Block; stack: Stack };
}) {
    return groundSurfaces
        .filter(
            (surface) =>
                surface.kind === 'ground' &&
                !blockedCellKeys.has(
                    cellKey(new Vector3(surface.x, 0, surface.z)),
                ) &&
                Math.hypot(
                    surface.x - tree.stack.position.x,
                    surface.z - tree.stack.position.z,
                ) <= squirrelHabitatRadiusBlocks,
        )
        .map(
            (surface) =>
                ({
                    id: `roam-${surface.x.toString()}-${surface.z.toString()}`,
                    position: new Vector3(surface.x, surface.y, surface.z),
                }) satisfies SquirrelTarget,
        );
}

function targetRank(seed: number, target: SquirrelTarget) {
    return hashSquirrelSeed(`${seed.toString()}:${target.id}`);
}

function createHabitatRevisionKey({
    blockedCells,
    groundSurfaces,
    tree,
}: {
    blockedCells: SquirrelPathCell[];
    groundSurfaces: AnimalMovementSurface[];
    tree: { block: Block; stack: Stack };
}) {
    const collisionSignature = blockedCells
        .map((cell) => `${cell.x.toString()}:${cell.z.toString()}`)
        .sort()
        .join('|');
    const surfaceSignature = groundSurfaces
        .map(
            (surface) =>
                `${surface.x.toString()}:${surface.y.toFixed(3)}:${surface.z.toString()}:${surface.kind}`,
        )
        .sort()
        .join('|');

    return hashSquirrelSeed(
        [
            tree.block.id,
            tree.stack.position.x.toString(),
            tree.stack.position.z.toString(),
            collisionSignature,
            surfaceSignature,
        ].join(':'),
    ).toString(16);
}

export function createSquirrelHabitats({
    blockData,
    gardenSeed,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    gardenSeed: string;
    stacks: Stack[] | undefined;
}) {
    const blockedCells = createAnimalBlockedCells(stacks);
    const blockedCellKeys = new Set(
        blockedCells.map((cell) => `${cell.x}:${cell.z}`),
    );
    const groundSurfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: squirrelGroundLift,
        stacks,
        swimDepth: 0,
    });
    const habitats: SquirrelHabitat[] = [];

    for (const tree of findTreeBlocks(stacks)) {
        const seed = hashSquirrelSeed(`${gardenSeed}:${tree.block.id}`);
        const escapeTargets = createTreeApproachTargets({
            blockedCellKeys,
            groundSurfaces,
            tree,
        }).sort(
            (left, right) =>
                targetRank(seed, left) - targetRank(seed, right) ||
                left.id.localeCompare(right.id),
        );
        const spawnTarget = escapeTargets[0];
        if (!spawnTarget) {
            continue;
        }

        const roamTargets = createRoamTargets({
            blockedCellKeys,
            groundSurfaces,
            tree,
        })
            .filter(
                (target) =>
                    findSquirrelPath({
                        blockedCells,
                        from: spawnTarget.position,
                        surfaces: groundSurfaces,
                        to: target.position,
                    }).status !== 'unreachable',
            )
            .sort(
                (left, right) =>
                    targetRank(seed, left) - targetRank(seed, right) ||
                    left.id.localeCompare(right.id),
            );
        if (roamTargets.length < squirrelMinimumRoamTargets) {
            continue;
        }

        const treePosition = new Vector3(
            tree.stack.position.x,
            spawnTarget.position.y,
            tree.stack.position.z,
        );
        habitats.push({
            blockedCells,
            escapeTargets,
            groundSurfaces,
            id: `squirrel-${tree.block.id}`,
            revisionKey: createHabitatRevisionKey({
                blockedCells,
                groundSurfaces,
                tree,
            }),
            roamTargets,
            seed,
            spawnTarget,
            treeBlockName: tree.block.name,
            treePosition,
        });
    }

    return habitats.sort((left, right) => left.id.localeCompare(right.id));
}
