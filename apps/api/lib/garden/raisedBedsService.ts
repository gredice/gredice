import {
    type RaisedBedOrientation,
    type SelectGardenStack,
    type SelectRaisedBed,
    updateRaisedBed,
} from '@gredice/storage';

type BlockPosition = { x: number; y: number; index: number };

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
    // Map blockId -> position and index
    const blockPositions = buildBlockPositionMap(stacks);

    // Build adjacency list of raised beds
    const adjacency = new Map<number, number[]>();
    for (const bed of raisedBeds) {
        adjacency.set(bed.id, []);
    }

    for (let i = 0; i < raisedBeds.length; i++) {
        const bedA = raisedBeds[i];
        if (!bedA.blockId) continue;
        const posA = blockPositions.get(bedA.blockId);
        if (!posA) continue;
        for (let j = i + 1; j < raisedBeds.length; j++) {
            const bedB = raisedBeds[j];
            if (!bedB.blockId) continue;
            const posB = blockPositions.get(bedB.blockId);
            if (!posB) continue;
            if (posA.index !== posB.index) continue;
            const adjacent =
                (posA.x === posB.x && Math.abs(posA.y - posB.y) === 1) ||
                (posA.y === posB.y && Math.abs(posA.x - posB.x) === 1);
            if (adjacent) {
                adjacency.get(bedA.id)?.push(bedB.id);
                adjacency.get(bedB.id)?.push(bedA.id);
            }
        }
    }

    // Traverse connected components and determine validity
    const visited = new Set<number>();
    const validity = new Map<number, boolean>();

    for (const bed of raisedBeds) {
        if (visited.has(bed.id)) continue;
        const stack: number[] = [bed.id];
        const component: number[] = [];
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) continue;
            if (visited.has(current)) continue;
            visited.add(current);
            component.push(current);
            const neighbors = adjacency.get(current) ?? [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        const isValid = component.length === 2;
        for (const id of component) {
            validity.set(id, isValid);
        }
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
                const hasHorizontalNeighbor = raisedBeds.some((other) => {
                    if (other.id === bed.id || !other.blockId) {
                        return false;
                    }
                    const neighborPosition = blockPositions.get(other.blockId);
                    if (!neighborPosition) {
                        return false;
                    }
                    return (
                        neighborPosition.index === position.index &&
                        neighborPosition.y === position.y &&
                        Math.abs(neighborPosition.x - position.x) === 1
                    );
                });
                const hasVerticalNeighbor = raisedBeds.some((other) => {
                    if (other.id === bed.id || !other.blockId) {
                        return false;
                    }
                    const neighborPosition = blockPositions.get(other.blockId);
                    if (!neighborPosition) {
                        return false;
                    }
                    return (
                        neighborPosition.index === position.index &&
                        neighborPosition.x === position.x &&
                        Math.abs(neighborPosition.y - position.y) === 1
                    );
                });
                if (hasHorizontalNeighbor) {
                    orientation = 'horizontal';
                } else if (hasVerticalNeighbor) {
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
