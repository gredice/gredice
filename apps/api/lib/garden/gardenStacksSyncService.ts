import {
    createRaisedBed,
    getGarden,
    getGardenBlocks,
    mergeRaisedBeds,
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

export function getRaisedBedMergeCandidates(params: {
    placements: RaisedBedPlacement[];
    raisedBeds: { id: number; blockId: string | null; status: string }[];
}) {
    const { placements, raisedBeds } = params;
    const placementByBlockId = new Map(
        placements.map((placement) => [placement.blockId, placement] as const),
    );
    const raisedBedByBlockId = new Map(
        raisedBeds
            .filter((raisedBed) => Boolean(raisedBed.blockId))
            .map(
                (raisedBed) =>
                    [raisedBed.blockId as string, raisedBed] as const,
            ),
    );

    const merges = new Map<number, number>();
    const mergedRaisedBedIds = new Set<number>();
    const processedPairs = new Set<string>();

    for (const placement of placements) {
        const adjacentPlacements = placements.filter(
            (candidate) =>
                candidate.blockId !== placement.blockId &&
                candidate.index === placement.index &&
                ((candidate.x === placement.x &&
                    Math.abs(candidate.y - placement.y) === 1) ||
                    (candidate.y === placement.y &&
                        Math.abs(candidate.x - placement.x) === 1)),
        );
        if (adjacentPlacements.length === 0) {
            continue;
        }

        for (const adjacentPlacement of adjacentPlacements) {
            const leftBlockId =
                placement.blockId.localeCompare(adjacentPlacement.blockId) <= 0
                    ? placement.blockId
                    : adjacentPlacement.blockId;
            const rightBlockId =
                leftBlockId === placement.blockId
                    ? adjacentPlacement.blockId
                    : placement.blockId;
            const pairKey = `${leftBlockId}|${rightBlockId}`;
            if (processedPairs.has(pairKey)) {
                continue;
            }
            processedPairs.add(pairKey);

            const leftRaisedBed = raisedBedByBlockId.get(leftBlockId);
            const rightRaisedBed = raisedBedByBlockId.get(rightBlockId);
            if (!leftRaisedBed || !rightRaisedBed) {
                continue;
            }

            if (leftRaisedBed.id === rightRaisedBed.id) {
                continue;
            }

            if (
                leftRaisedBed.status !== 'new' ||
                rightRaisedBed.status !== 'new'
            ) {
                continue;
            }

            if (
                mergedRaisedBedIds.has(leftRaisedBed.id) ||
                mergedRaisedBedIds.has(rightRaisedBed.id)
            ) {
                continue;
            }

            const leftPlacement = placementByBlockId.get(leftBlockId);
            const rightPlacement = placementByBlockId.get(rightBlockId);
            if (!leftPlacement || !rightPlacement) {
                continue;
            }

            if (leftPlacement.index !== rightPlacement.index) {
                continue;
            }

            const targetRaisedBedId = leftRaisedBed.id;
            const sourceRaisedBedId = rightRaisedBed.id;
            merges.set(targetRaisedBedId, sourceRaisedBedId);
            mergedRaisedBedIds.add(targetRaisedBedId);
            mergedRaisedBedIds.add(sourceRaisedBedId);
        }
    }

    return Array.from(merges.entries()).map(([targetId, sourceId]) => ({
        targetRaisedBedId: targetId,
        sourceRaisedBedId: sourceId,
    }));
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

    const blockNameByIdInitial = new Map(
        blocks.map((block) => [block.id, block.name] as const),
    );
    const raisedBedPlacementsInitial = getRaisedBedPlacements(
        gardenAfterStackCleanup.stacks,
        blockNameByIdInitial,
    );
    const mergeCandidates = getRaisedBedMergeCandidates({
        placements: raisedBedPlacementsInitial,
        raisedBeds: gardenAfterStackCleanup.raisedBeds,
    });

    if (mergeCandidates.length > 0) {
        for (const mergeCandidate of mergeCandidates) {
            await mergeRaisedBeds(
                mergeCandidate.targetRaisedBedId,
                mergeCandidate.sourceRaisedBedId,
            );
        }
    }

    const gardenAfterMerge =
        mergeCandidates.length > 0
            ? await getGarden(gardenId)
            : gardenAfterStackCleanup;
    if (!gardenAfterMerge) {
        return;
    }

    const existingRaisedBedBlockIds = new Set(
        gardenAfterMerge.raisedBeds
            .map((raisedBed) => raisedBed.blockId)
            .filter((blockId): blockId is string => Boolean(blockId)),
    );

    const blockNameById = new Map(
        blocks.map((block) => [block.id, block.name] as const),
    );

    const raisedBedPlacements = getRaisedBedPlacements(
        gardenAfterMerge.stacks,
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
                gardenId: gardenAfterMerge.id,
                accountId: gardenAfterMerge.accountId,
            });
        }
    }

    const gardenForOrientationUpdate =
        missingRaisedBedBlockIds.size > 0 || mergeCandidates.length > 0
            ? await getGarden(gardenId)
            : gardenAfterMerge;

    if (!gardenForOrientationUpdate) {
        return;
    }

    await updateRaisedBedsOrientation(
        gardenForOrientationUpdate,
        blockNameById,
    );
}
