import type { BlockData } from '@gredice/client';
import type { Vector3 } from 'three';
import {
    type ActiveDragPreviewTargetOffset,
    createActiveDragPreviewTarget,
} from '../dragPreviewIdentity';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getBlockDataByName, getStackHeight } from '../utils/stackHeightCore';

export type MovingSegment = {
    sourceStack: Stack;
    sourceStartIndex: number;
    blocks: Stack['blocks'];
    baseHeight: number;
    canRecycle: boolean;
};

type PlacementPreview = {
    blockUnderId: string | null;
    blockUnderName: string | null;
    destination: {
        x: number;
        z: number;
    };
    hoverHeight: number;
    isRecycler: boolean;
    isBlocked: boolean;
    segment: MovingSegment;
};

export type ResolvedPlacementPreview = {
    relative: Vector3;
    previewHoverHeight: number;
    hoveredGardenBoxBlockId: string | null;
    canStoreInGardenBox: boolean;
    nextIsOverRecycler: boolean;
    nextIsBlocked: boolean;
    targetOffsets: ActiveDragPreviewTargetOffset[];
};

function getStack(
    stacks: Stack[] | undefined,
    destination: { x: number; z: number },
) {
    return stacks?.find(
        (candidate) =>
            candidate.position.x === destination.x &&
            candidate.position.z === destination.z,
    );
}

function createTargetOffsets(
    placementPreviews: PlacementPreview[],
    hoverHeight: number,
): ActiveDragPreviewTargetOffset[] {
    return placementPreviews.flatMap((preview) =>
        preview.segment.blocks.map((segmentBlock, segmentBlockOffset) => ({
            ...createActiveDragPreviewTarget({
                blockId: segmentBlock.id,
                blockIndex:
                    preview.segment.sourceStartIndex + segmentBlockOffset,
                stackPosition: preview.segment.sourceStack.position,
            }),
            hoverHeight,
        })),
    );
}

function getExternalRaisedBedBlockAtPosition({
    movingBlockIds,
    stacks,
    x,
    z,
}: {
    movingBlockIds: Set<string>;
    stacks: Stack[] | undefined;
    x: number;
    z: number;
}): Block | null {
    const stackAtPosition = getStack(stacks, { x, z });
    const candidateBlocks =
        stackAtPosition?.blocks.filter(
            (candidate) => !movingBlockIds.has(candidate.id),
        ) ?? [];

    for (
        let candidateIndex = candidateBlocks.length - 1;
        candidateIndex >= 0;
        candidateIndex--
    ) {
        const candidateBlock = candidateBlocks[candidateIndex];
        if (candidateBlock?.name === 'Raised_Bed') {
            return candidateBlock;
        }
    }

    return null;
}

function hasExternalRaisedBedNeighbor({
    excludedPositions,
    movingBlockIds,
    stacks,
    x,
    z,
}: {
    excludedPositions: Set<string>;
    movingBlockIds: Set<string>;
    stacks: Stack[] | undefined;
    x: number;
    z: number;
}) {
    const neighbors = [
        { x: x - 1, z },
        { x: x + 1, z },
        { x, z: z - 1 },
        { x, z: z + 1 },
    ];

    return neighbors.some((neighbor) => {
        if (excludedPositions.has(`${neighbor.x}|${neighbor.z}`)) {
            return false;
        }

        return Boolean(
            getExternalRaisedBedBlockAtPosition({
                movingBlockIds,
                stacks,
                x: neighbor.x,
                z: neighbor.z,
            }),
        );
    });
}

function isRaisedBedPlacementBlocked({
    movingBlockIds,
    movedRaisedBedPreviews,
    stacks,
}: {
    movingBlockIds: Set<string>;
    movedRaisedBedPreviews: PlacementPreview[];
    stacks: Stack[] | undefined;
}) {
    const movedRaisedBedPreviewByPosition = new Map(
        movedRaisedBedPreviews.map((preview) => [
            `${preview.destination.x}|${preview.destination.z}`,
            preview,
        ]),
    );

    return movedRaisedBedPreviews.some((preview) => {
        const neighbors = [
            { x: preview.destination.x - 1, z: preview.destination.z },
            { x: preview.destination.x + 1, z: preview.destination.z },
            { x: preview.destination.x, z: preview.destination.z - 1 },
            { x: preview.destination.x, z: preview.destination.z + 1 },
        ];

        let raisedBedNeighborCount = 0;
        let externalNeighbor:
            | {
                  x: number;
                  z: number;
              }
            | undefined;

        for (const neighbor of neighbors) {
            const movedNeighbor = movedRaisedBedPreviewByPosition.get(
                `${neighbor.x}|${neighbor.z}`,
            );
            if (movedNeighbor) {
                raisedBedNeighborCount += 1;
                continue;
            }

            const externalNeighborBlock = getExternalRaisedBedBlockAtPosition({
                movingBlockIds,
                stacks,
                x: neighbor.x,
                z: neighbor.z,
            });
            if (externalNeighborBlock) {
                raisedBedNeighborCount += 1;
                externalNeighbor = {
                    x: neighbor.x,
                    z: neighbor.z,
                };
            }
        }

        if (raisedBedNeighborCount > 1) {
            return true;
        }

        if (!externalNeighbor) {
            return false;
        }

        const excludedPositions = new Set<string>([
            `${preview.destination.x}|${preview.destination.z}`,
            ...movedRaisedBedPreviews.map(
                (candidatePreview) =>
                    `${candidatePreview.destination.x}|${candidatePreview.destination.z}`,
            ),
        ]);

        return hasExternalRaisedBedNeighbor({
            excludedPositions,
            movingBlockIds,
            stacks,
            x: externalNeighbor.x,
            z: externalNeighbor.z,
        });
    });
}

export function resolvePickupPlacementPreviewForRelative({
    blockData,
    gardenIsSandbox,
    localSandboxStorageKey,
    movingSegments,
    relative,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    gardenIsSandbox: boolean;
    localSandboxStorageKey: string | null;
    movingSegments: MovingSegment[];
    relative: Vector3;
    stacks: Stack[] | undefined;
}): ResolvedPlacementPreview | null {
    if (!blockData || movingSegments.length === 0) {
        return null;
    }

    const movingBlockIds = new Set(
        movingSegments.flatMap((segment) =>
            segment.blocks.map((segmentBlock) => segmentBlock.id),
        ),
    );

    const placementPreviews: PlacementPreview[] = movingSegments.flatMap(
        (segment) => {
            if (!segment.blocks[0]) {
                return [];
            }

            const destination = {
                x: segment.sourceStack.position.x + relative.x,
                z: segment.sourceStack.position.z + relative.z,
            };
            const destinationStack = getStack(stacks, destination);
            const destinationBlocks =
                destinationStack?.blocks.filter(
                    (candidate) => !movingBlockIds.has(candidate.id),
                ) ?? [];
            const destinationWithoutMoving = destinationStack
                ? {
                      ...destinationStack,
                      blocks: destinationBlocks,
                  }
                : undefined;
            const blockUnder = destinationBlocks.at(-1);
            const blockUnderData = blockUnder
                ? getBlockDataByName(blockData, blockUnder.name)
                : null;
            const isRecycler =
                segment.canRecycle &&
                blockUnder?.name !== 'Composter' &&
                (blockUnderData?.functions?.recycler ?? false);
            const isStackable = blockUnderData?.attributes?.stackable ?? true;
            const hoverHeight =
                getStackHeight(blockData, destinationWithoutMoving) -
                segment.baseHeight;

            return [
                {
                    blockUnderId: blockUnder?.id ?? null,
                    blockUnderName: blockUnder?.name ?? null,
                    destination,
                    hoverHeight,
                    isRecycler,
                    isBlocked: !isStackable && !isRecycler,
                    segment,
                },
            ];
        },
    );

    const movedRaisedBedPreviews = placementPreviews.filter((preview) =>
        preview.segment.blocks.some(
            (segmentBlock) => segmentBlock.name === 'Raised_Bed',
        ),
    );
    const raisedBedPlacementBlocked = isRaisedBedPlacementBlocked({
        movingBlockIds,
        movedRaisedBedPreviews,
        stacks,
    });

    const sourcePreview = placementPreviews[0];
    if (!sourcePreview) {
        return null;
    }

    const sourceHoverHeight = sourcePreview.hoverHeight;
    const previewHoverHeight = Math.max(
        ...placementPreviews.map((preview) => preview.hoverHeight),
    );
    const hoveredGardenBoxBlockId =
        placementPreviews.find(
            (preview) => preview.blockUnderName === 'GardenBox',
        )?.blockUnderId ?? null;
    const canStoreInGardenBox =
        !localSandboxStorageKey &&
        !gardenIsSandbox &&
        hoveredGardenBoxBlockId !== null &&
        sourcePreview.segment.blocks.length === 1 &&
        sourcePreview.segment.blocks[0]?.name !== 'GardenBox' &&
        sourcePreview.segment.blocks[0]?.name !== 'Raised_Bed' &&
        placementPreviews.length === 1;
    const heightsMismatch = placementPreviews.some(
        (preview) => Math.abs(sourceHoverHeight - preview.hoverHeight) > 0.0001,
    );
    const nextIsOverRecycler = sourcePreview.isRecycler;
    const nextIsBlocked = nextIsOverRecycler
        ? false
        : canStoreInGardenBox
          ? false
          : placementPreviews.some((preview) => preview.isBlocked) ||
            heightsMismatch ||
            raisedBedPlacementBlocked;

    return {
        relative: relative.clone(),
        previewHoverHeight,
        hoveredGardenBoxBlockId,
        canStoreInGardenBox,
        nextIsOverRecycler,
        nextIsBlocked,
        targetOffsets: createTargetOffsets(
            placementPreviews,
            previewHoverHeight,
        ),
    };
}
