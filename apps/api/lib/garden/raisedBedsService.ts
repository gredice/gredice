import {
    type RaisedBedOrientation,
    type SelectGardenStack,
    type SelectRaisedBed,
    updateRaisedBed,
} from '@gredice/storage';

type BlockPosition = { x: number; y: number; index: number };

type RaisedBedInput = Pick<SelectRaisedBed, 'id' | 'blockId'>;

type AdjacentBlockAtSameIndex = {
    blockId: string;
    x: number;
    y: number;
};

function getAdjacentBlocksAtSameIndex(
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
    position: BlockPosition,
): AdjacentBlockAtSameIndex[] {
    const neighborPositions = [
        { x: position.x - 1, y: position.y },
        { x: position.x + 1, y: position.y },
        { x: position.x, y: position.y - 1 },
        { x: position.x, y: position.y + 1 },
    ];

    return neighborPositions
        .map(({ x, y }) => {
            const stack = stacks.find(
                (candidate) =>
                    candidate.positionX === x && candidate.positionY === y,
            );
            const blockId = stack?.blocks[position.index];
            if (!blockId) {
                return null;
            }
            return { blockId, x, y };
        })
        .filter((candidate): candidate is AdjacentBlockAtSameIndex =>
            Boolean(candidate),
        );
}

function getAdjacentBlockIdsAtSameIndex(
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
    position: BlockPosition,
): string[] {
    return getAdjacentBlocksAtSameIndex(stacks, position).map(
        (candidate) => candidate.blockId,
    );
}

function buildRaisedBedAdjacencyByRecord(
    raisedBeds: RaisedBedInput[],
    blockPositions: Map<string, BlockPosition>,
): Map<number, number[]> {
    const adjacency = new Map<number, number[]>();
    for (const bed of raisedBeds) {
        adjacency.set(bed.id, []);
    }

    for (let i = 0; i < raisedBeds.length; i++) {
        const bedA = raisedBeds[i];
        if (!bedA?.blockId) {
            continue;
        }
        const posA = blockPositions.get(bedA.blockId);
        if (!posA) {
            continue;
        }

        for (let j = i + 1; j < raisedBeds.length; j++) {
            const bedB = raisedBeds[j];
            if (!bedB?.blockId) {
                continue;
            }
            const posB = blockPositions.get(bedB.blockId);
            if (!posB || posA.index !== posB.index) {
                continue;
            }

            const adjacent =
                (posA.x === posB.x && Math.abs(posA.y - posB.y) === 1) ||
                (posA.y === posB.y && Math.abs(posA.x - posB.x) === 1);
            if (adjacent) {
                adjacency.get(bedA.id)?.push(bedB.id);
                adjacency.get(bedB.id)?.push(bedA.id);
            }
        }
    }

    return adjacency;
}

function buildComponentSizeByRaisedBedId(
    raisedBeds: RaisedBedInput[],
    adjacency: Map<number, number[]>,
): Map<number, number> {
    const visited = new Set<number>();
    const componentSizeByRaisedBedId = new Map<number, number>();

    for (const bed of raisedBeds) {
        if (visited.has(bed.id)) {
            continue;
        }

        const queue = [bed.id];
        const component: number[] = [];
        while (queue.length > 0) {
            const current = queue.pop();
            if (current === undefined || visited.has(current)) {
                continue;
            }

            visited.add(current);
            component.push(current);

            const neighbors = adjacency.get(current) ?? [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }

        for (const raisedBedId of component) {
            componentSizeByRaisedBedId.set(raisedBedId, component.length);
        }
    }

    return componentSizeByRaisedBedId;
}

function buildBlockPositionMap(
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
) {
    const blockPositions = new Map<string, BlockPosition>();
    for (const stack of stacks) {
        (stack.blocks ?? []).forEach((blockId, index) => {
            blockPositions.set(blockId, {
                x: stack.positionX,
                y: stack.positionY,
                index,
            });
        });
    }
    return blockPositions;
}

/**
 * Calculates validity of raised beds based on their configuration.
 * A valid configuration consists of exactly two adjacent raised beds
 * placed next to each other horizontally or vertically on the same height.
 *
 * Returns a map of raised bed id to a boolean indicating if the configuration is valid.
 */
export function calculateRaisedBedsValidity(
    raisedBeds: Pick<SelectRaisedBed, 'id' | 'blockId'>[],
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
): Map<number, boolean> {
    const blockPositions = buildBlockPositionMap(stacks);
    const adjacency = buildRaisedBedAdjacencyByRecord(
        raisedBeds,
        blockPositions,
    );
    const componentSizeByRaisedBedId = buildComponentSizeByRaisedBedId(
        raisedBeds,
        adjacency,
    );
    const raisedBedBlockIds = new Set(
        raisedBeds
            .map((raisedBed) => raisedBed.blockId)
            .filter((blockId): blockId is string => Boolean(blockId)),
    );

    const validity = new Map<number, boolean>();
    for (const bed of raisedBeds) {
        if (!bed.blockId) {
            validity.set(bed.id, false);
            continue;
        }

        const position = blockPositions.get(bed.blockId);
        if (!position) {
            validity.set(bed.id, false);
            continue;
        }

        const adjacentBlockIds = getAdjacentBlockIdsAtSameIndex(
            stacks,
            position,
        );
        const adjacentRaisedBedRecordBlockIds = adjacentBlockIds.filter(
            (blockId) => raisedBedBlockIds.has(blockId),
        );
        const adjacentOrphanBlockIds = adjacentBlockIds.filter(
            (blockId) => !raisedBedBlockIds.has(blockId),
        );
        const totalAdjacentCount =
            adjacentRaisedBedRecordBlockIds.length +
            adjacentOrphanBlockIds.length;
        if (totalAdjacentCount !== 1) {
            validity.set(bed.id, false);
            continue;
        }

        const componentSize = componentSizeByRaisedBedId.get(bed.id) ?? 1;
        const isValidSingleRecordPair =
            componentSize === 1 && adjacentOrphanBlockIds.length === 1;
        const isValidTwoRecordPair =
            componentSize === 2 && adjacentRaisedBedRecordBlockIds.length === 1;

        validity.set(bed.id, isValidSingleRecordPair || isValidTwoRecordPair);
    }

    return validity;
}

export function calculateRaisedBedsOrientation(
    raisedBeds: Pick<SelectRaisedBed, 'id' | 'blockId'>[],
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[],
): Map<number, RaisedBedOrientation> {
    const blockPositions = buildBlockPositionMap(stacks);
    const orientations = new Map<number, RaisedBedOrientation>();

    for (const bed of raisedBeds) {
        let orientation: RaisedBedOrientation = 'vertical';
        if (bed.blockId) {
            const position = blockPositions.get(bed.blockId);
            if (position) {
                const adjacentBlocks = getAdjacentBlocksAtSameIndex(
                    stacks,
                    position,
                );
                const hasHorizontalNeighbor = adjacentBlocks.some(
                    (neighbor) =>
                        neighbor.x === position.x &&
                        Math.abs(neighbor.y - position.y) === 1,
                );
                const hasVerticalNeighbor = adjacentBlocks.some(
                    (neighbor) =>
                        neighbor.y === position.y &&
                        Math.abs(neighbor.x - position.x) === 1,
                );

                if (hasHorizontalNeighbor && !hasVerticalNeighbor) {
                    orientation = 'horizontal';
                } else if (hasVerticalNeighbor && !hasHorizontalNeighbor) {
                    orientation = 'vertical';
                } else {
                    orientation = 'vertical';
                }
            }
        }
        orientations.set(bed.id, orientation);
    }

    return orientations;
}

export async function updateRaisedBedsOrientation(garden: {
    id: number;
    raisedBeds: Pick<SelectRaisedBed, 'id' | 'blockId' | 'orientation'>[];
    stacks: Pick<SelectGardenStack, 'positionX' | 'positionY' | 'blocks'>[];
}) {
    const orientations = calculateRaisedBedsOrientation(
        garden.raisedBeds,
        garden.stacks,
    );

    const updates = garden.raisedBeds
        .map((raisedBed) => {
            const orientation = orientations.get(raisedBed.id) ?? 'vertical';
            if (raisedBed.orientation === orientation) {
                return null;
            }
            return updateRaisedBed({
                id: raisedBed.id,
                orientation,
            });
        })
        .filter(Boolean);

    if (updates.length > 0) {
        await Promise.all(updates);
    }

    return orientations;
}
