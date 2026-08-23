import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import { createAnimalBlockedCells } from './animalMovementTerrain';

export type AnimalFlightObstacle = {
    blockIds: string[];
    topY: number;
    x: number;
    z: number;
};

const horizontalClearance = 0.08;
const verticalClearance = 0.28;
const flightSampleSpacing = 0.14;

function cellKey(x: number, z: number) {
    return `${Math.round(x)}:${Math.round(z)}`;
}

export function createAnimalFlightObstacles({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}) {
    const blockedCells = new Set(
        createAnimalBlockedCells(stacks).map(({ x, z }) => cellKey(x, z)),
    );

    return (stacks ?? []).flatMap((stack) => {
        if (!blockedCells.has(cellKey(stack.position.x, stack.position.z))) {
            return [];
        }

        return [
            {
                blockIds: stack.blocks.map((block) => block.id),
                topY: getStackHeight(blockData, stack),
                x: stack.position.x,
                z: stack.position.z,
            } satisfies AnimalFlightObstacle,
        ];
    });
}

function obstacleIgnored(
    obstacle: AnimalFlightObstacle,
    ignoredBlockIds: ReadonlySet<string>,
) {
    return obstacle.blockIds.some((blockId) => ignoredBlockIds.has(blockId));
}

export function isAnimalFlightPositionSafe({
    ignoredBlockIds = new Set<string>(),
    obstacles,
    position,
}: {
    ignoredBlockIds?: ReadonlySet<string>;
    obstacles: readonly AnimalFlightObstacle[];
    position: Pick<Vector3, 'x' | 'y' | 'z'>;
}) {
    return obstacles.every(
        (obstacle) =>
            obstacleIgnored(obstacle, ignoredBlockIds) ||
            Math.abs(position.x - obstacle.x) > 0.5 + horizontalClearance ||
            Math.abs(position.z - obstacle.z) > 0.5 + horizontalClearance ||
            position.y > obstacle.topY + verticalClearance,
    );
}

export function isAnimalFlightSegmentClear({
    from,
    ignoredBlockIds = new Set<string>(),
    obstacles,
    to,
}: {
    from: Vector3;
    ignoredBlockIds?: ReadonlySet<string>;
    obstacles: readonly AnimalFlightObstacle[];
    to: Vector3;
}) {
    const distance = from.distanceTo(to);
    const sampleCount = Math.max(1, Math.ceil(distance / flightSampleSpacing));

    for (let index = 0; index <= sampleCount; index += 1) {
        const position = from.clone().lerp(to, index / sampleCount);
        if (
            !isAnimalFlightPositionSafe({
                ignoredBlockIds,
                obstacles,
                position,
            })
        ) {
            return false;
        }
    }

    return true;
}

export function createObstacleSafeFlightWaypoints({
    from,
    ignoredBlockIds = new Set<string>(),
    obstacles,
    to,
}: {
    from: Vector3;
    ignoredBlockIds?: ReadonlySet<string>;
    obstacles: readonly AnimalFlightObstacle[];
    to: Vector3;
}) {
    if (
        isAnimalFlightSegmentClear({
            from,
            ignoredBlockIds,
            obstacles,
            to,
        })
    ) {
        return [to.clone()];
    }

    const relevantObstacleTop = obstacles.reduce(
        (top, obstacle) =>
            obstacleIgnored(obstacle, ignoredBlockIds)
                ? top
                : Math.max(top, obstacle.topY),
        0,
    );
    const safeY =
        Math.max(from.y, to.y, relevantObstacleTop + verticalClearance) + 0.32;
    const aboveStart = new Vector3(from.x, safeY, from.z);
    const aboveTarget = new Vector3(to.x, safeY, to.z);
    const candidates = [aboveStart, aboveTarget, to.clone()];

    const waypoints: Vector3[] = [];
    let cursor = from;
    for (const candidate of candidates) {
        if (
            isAnimalFlightSegmentClear({
                from: cursor,
                ignoredBlockIds,
                obstacles,
                to: candidate,
            })
        ) {
            waypoints.push(candidate);
            cursor = candidate;
        }
    }

    const reachedTarget = cursor.distanceTo(to) < 0.001;
    return reachedTarget ? waypoints : [];
}
