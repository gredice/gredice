import { normalizeGardenBlockRotation } from '@gredice/js/gardenBlocks';
import type { Block } from '../types/Block';
import { createGardenPosition, type GardenStack } from '../types/Stack';

// Pure cache updates for an Expand batch. Each one walks the stacks once and
// is applied with one `setQueryData`, however many copies the batch has
// (`replaceOptimisticBlockId` and friends map every stack per block).

type GardenWithStacks = {
    stacks: GardenStack[];
};

/** One copy of the batch: its client id and its cell (`y` is the garden z). */
export type OptimisticBatchPlacement = {
    blockId: string;
    position: { x: number; y: number };
};

function cellKey(x: number, y: number) {
    return `${x}|${y}`;
}

/**
 * Adds every copy to the stack at its cell, or a new stack when the cell has
 * none. Copies take the source's rotation, normalized to 0–3. When legacy
 * data has two stacks at one cell, the first one gets the copy, as the
 * server writes it.
 */
export function applyOptimisticBatchPlacement<TGarden extends GardenWithStacks>(
    garden: TGarden,
    {
        blockName,
        placements,
        rotation,
    }: {
        blockName: string;
        placements: readonly OptimisticBatchPlacement[];
        rotation: number | null | undefined;
    },
): TGarden {
    if (placements.length === 0) {
        return garden;
    }

    const normalizedRotation = normalizeGardenBlockRotation(rotation);
    const blocksByCell = new Map<
        string,
        { x: number; y: number; blocks: Block[] }
    >();
    for (const placement of placements) {
        const key = cellKey(placement.position.x, placement.position.y);
        const entry = blocksByCell.get(key) ?? {
            x: placement.position.x,
            y: placement.position.y,
            blocks: [],
        };
        entry.blocks.push({
            id: placement.blockId,
            name: blockName,
            rotation: normalizedRotation,
        });
        blocksByCell.set(key, entry);
    }

    const stacks = garden.stacks.map((stack) => {
        const key = cellKey(stack.position.x, stack.position.z);
        const entry = blocksByCell.get(key);
        if (!entry) {
            return stack;
        }

        blocksByCell.delete(key);
        return { ...stack, blocks: [...stack.blocks, ...entry.blocks] };
    });
    for (const entry of blocksByCell.values()) {
        stacks.push({
            position: createGardenPosition(entry.x, 0, entry.y),
            blocks: entry.blocks,
        });
    }

    return { ...garden, stacks };
}

/**
 * Replaces optimistic ids with the saved ones (pairs of `[from, to]`).
 * `paidSunflowers` is the receipt's unit price: the server stores it for
 * every copy and refunds it when one is recycled, so a Remove right after
 * the Expand can show the refund before the garden is refetched.
 */
export function confirmOptimisticBatchPlacement<
    TGarden extends GardenWithStacks,
>(
    garden: TGarden,
    pairs: Iterable<readonly [from: string, to: string]>,
    { paidSunflowers }: { paidSunflowers?: number } = {},
): TGarden {
    const savedIdById = new Map(pairs);
    if (savedIdById.size === 0) {
        return garden;
    }

    let changed = false;
    const stacks = garden.stacks.map((stack) => {
        let stackChanged = false;
        const blocks = stack.blocks.map((block) => {
            const savedId = savedIdById.get(block.id);
            if (savedId === undefined || savedId === block.id) {
                return block;
            }

            stackChanged = true;
            return paidSunflowers === undefined
                ? { ...block, id: savedId }
                : { ...block, id: savedId, paidSunflowers };
        });
        if (!stackChanged) {
            return stack;
        }

        changed = true;
        return { ...stack, blocks };
    });

    return changed ? { ...garden, stacks } : garden;
}

/**
 * Takes the batch's copies out again. A stack that held only copies goes
 * away; other optimistic blocks stay.
 */
export function rollbackOptimisticBatchPlacement<
    TGarden extends GardenWithStacks,
>(garden: TGarden, blockIds: Iterable<string>): TGarden {
    const removedIds = new Set(blockIds);
    if (removedIds.size === 0) {
        return garden;
    }

    let changed = false;
    const stacks = garden.stacks.flatMap((stack) => {
        const blocks = stack.blocks.filter(
            (block) => !removedIds.has(block.id),
        );
        if (blocks.length === stack.blocks.length) {
            return [stack];
        }

        changed = true;
        return blocks.length === 0 ? [] : [{ ...stack, blocks }];
    });

    return changed ? { ...garden, stacks } : garden;
}

/** Drop animations a batch plays at most, so a 10 × 10 does not stall. */
export const batchPlacementDropAnimationLimit = 12;

/**
 * Which copies get the placement effects: drop animations for the first
 * `limit` (placements come ordered by distance from the source), and the
 * one sunflower fly-in for the copy nearest the middle of the placed area.
 * Returns indices into `placements`.
 */
export function selectBatchPlacementEffects(
    placements: readonly { position: { x: number; y: number } }[],
    limit = batchPlacementDropAnimationLimit,
) {
    const animatedIndices = placements
        .slice(0, Math.max(0, limit))
        .map((_, index) => index);
    if (placements.length === 0) {
        return { animatedIndices, sunflowerEffectIndex: null };
    }

    let centreX = 0;
    let centreY = 0;
    for (const placement of placements) {
        centreX += placement.position.x / placements.length;
        centreY += placement.position.y / placements.length;
    }

    let sunflowerEffectIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    placements.forEach((placement, index) => {
        const distance =
            (placement.position.x - centreX) ** 2 +
            (placement.position.y - centreY) ** 2;
        if (distance < nearestDistance) {
            nearestDistance = distance;
            sunflowerEffectIndex = index;
        }
    });

    return { animatedIndices, sunflowerEffectIndex };
}
