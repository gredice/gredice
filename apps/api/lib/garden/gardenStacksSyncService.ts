import {
    createRaisedBed,
    getGarden,
    getGardenBlocks,
    updateGardenStack,
} from '@gredice/storage';
import { updateRaisedBedsOrientation } from './raisedBedsService';

type RaisedBedPlacement = {
    blockId: string;
    index: number;
    x: number;
    y: number;
};

function getRaisedBedPlacements(
    stacks: {
        positionX: number;
        positionY: number;
        blocks: string[];
    }[],
    blockNameById: Map<string, string>,
): RaisedBedPlacement[] {
    return stacks.flatMap((stack) =>
        stack.blocks
            .map((blockId, index) => ({
                blockId,
                index,
                x: stack.positionX,
                y: stack.positionY,
            }))
            .filter(
                ({ blockId }) => blockNameById.get(blockId) === 'Raised_Bed',
            ),
    );
}

function getMissingRaisedBedBlockIds(
    placements: RaisedBedPlacement[],
    existingRaisedBedBlockIds: Set<string>,
) {
    const raisedBedsToCreate = new Set<string>();

    for (const placement of placements) {
        if (existingRaisedBedBlockIds.has(placement.blockId)) {
            continue;
        }

        const adjacentRaisedBed = placements.find(
            (candidate) =>
                candidate.blockId !== placement.blockId &&
                candidate.index === placement.index &&
                ((candidate.x === placement.x &&
                    Math.abs(candidate.y - placement.y) === 1) ||
                    (candidate.y === placement.y &&
                        Math.abs(candidate.x - placement.x) === 1)),
        );

        if (adjacentRaisedBed) {
            if (existingRaisedBedBlockIds.has(adjacentRaisedBed.blockId)) {
                continue;
            }

            const canonicalBlockId = [
                placement.blockId,
                adjacentRaisedBed.blockId,
            ].sort((left, right) => left.localeCompare(right))[0];
            if (canonicalBlockId !== placement.blockId) {
                continue;
            }
        }

        raisedBedsToCreate.add(placement.blockId);
    }

    return raisedBedsToCreate;
}

export async function synchronizeGardenStacksAndRaisedBeds(gardenId: number) {
    const [garden, blocks] = await Promise.all([
        getGarden(gardenId),
        getGardenBlocks(gardenId),
    ]);

    if (!garden) {
        return;
    }

    const validBlockIds = new Set(blocks.map((block) => block.id));
    const stacksToClean = garden.stacks
        .map((stack) => ({
            x: stack.positionX,
            y: stack.positionY,
            validBlocks: stack.blocks.filter((id) => validBlockIds.has(id)),
            hasInvalidBlocks:
                stack.blocks.filter((id) => validBlockIds.has(id)).length !==
                stack.blocks.length,
        }))
        .filter((stack) => stack.hasInvalidBlocks);

    if (stacksToClean.length > 0) {
        await Promise.all(
            stacksToClean.map(({ x, y, validBlocks }) =>
                updateGardenStack(gardenId, {
                    x,
                    y,
                    blocks: validBlocks,
                }),
            ),
        );
    }

    const gardenAfterStackCleanup =
        stacksToClean.length > 0 ? await getGarden(gardenId) : garden;
    if (!gardenAfterStackCleanup) {
        return;
    }

    const existingRaisedBedBlockIds = new Set(
        gardenAfterStackCleanup.raisedBeds
            .map((raisedBed) => raisedBed.blockId)
            .filter((blockId): blockId is string => Boolean(blockId)),
    );

    const blockNameById = new Map(
        blocks.map((block) => [block.id, block.name] as const),
    );

    const raisedBedPlacements = getRaisedBedPlacements(
        gardenAfterStackCleanup.stacks,
        blockNameById,
    );

    const missingRaisedBedBlockIds = getMissingRaisedBedBlockIds(
        raisedBedPlacements,
        existingRaisedBedBlockIds,
    );

    if (missingRaisedBedBlockIds.size > 0) {
        for (const blockId of missingRaisedBedBlockIds) {
            await createRaisedBed({
                blockId,
                gardenId: gardenAfterStackCleanup.id,
                accountId: gardenAfterStackCleanup.accountId,
            });
        }
    }

    const gardenForOrientationUpdate =
        missingRaisedBedBlockIds.size > 0
            ? await getGarden(gardenId)
            : gardenAfterStackCleanup;

    if (!gardenForOrientationUpdate) {
        return;
    }

    await updateRaisedBedsOrientation(gardenForOrientationUpdate);
}
