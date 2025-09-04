import type { SelectGardenStack, SelectRaisedBed } from '@gredice/storage';

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
    const blockPositions = new Map<string, { x: number; y: number; index: number }>();
    for (const stack of stacks) {
        stack.blocks.forEach((blockId, index) => {
            blockPositions.set(blockId, {
                x: stack.positionX,
                y: stack.positionY,
                index,
            });
        });
    }

    // Build adjacency list of raised beds
    const adjacency = new Map<number, number[]>();
    for (const bed of raisedBeds) {
        adjacency.set(bed.id, []);
    }

    for (let i = 0; i < raisedBeds.length; i++) {
        const bedA = raisedBeds[i];
        const posA = blockPositions.get(bedA.blockId);
        if (!posA) continue;
        for (let j = i + 1; j < raisedBeds.length; j++) {
            const bedB = raisedBeds[j];
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
            const current = stack.pop()!;
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

