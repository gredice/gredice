import type { BlockData } from '@gredice/client';
import type { OperationVisualReward } from '../../operationVisualRewards';
import type { Stack } from '../../types/Stack';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getBlockDataByName,
    getStackHeight,
} from '../../utils/stackHeightCore';

type RaisedBedHarvestFieldInput = {
    active?: boolean | null;
    id: number | string;
    plantSortId?: number | null;
    positionIndex: number;
};

type ResolveRaisedBedHarvestPositionsInput = {
    blockOffset: number;
    fields: RaisedBedHarvestFieldInput[];
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

type ResolveRaisedBedHarvestBasketStateInput = {
    fields: RaisedBedHarvestFieldInput[];
    hiddenOperationIds?: ReadonlySet<number>;
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

type ResolveRaisedBedHarvestBasketPlacementInput = {
    blockData: BlockData[] | null | undefined;
    blockIds: string[];
    reservedPositionKeys?: ReadonlySet<string>;
    stacks: Stack[];
};

type ResolveRaisedBedHarvestBasketPlacementsInput = {
    blockData: BlockData[] | null | undefined;
    raisedBeds: {
        blockIds: string[];
        raisedBedId: number;
    }[];
    stacks: Stack[];
};

export type RaisedBedHarvestBasketFillLevel = 'empty' | 'full' | 'partial';

export type RaisedBedHarvestBasketState = {
    fillLevel: RaisedBedHarvestBasketFillLevel;
    operationIds: number[];
    producePlantSortIds: number[];
};

export type RaisedBedHarvestBasketPlacement = {
    position: [number, number, number];
    rotation: number;
};

function isHarvestRewardForRaisedBed(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        reward.family === 'harvest' &&
        reward.raisedBedId === raisedBedId
    );
}

export function isHarvestRewardCompleted(reward: OperationVisualReward) {
    return reward.status === 'completed';
}

export function resolveRaisedBedHarvestPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedHarvestPositionsInput) {
    const hasRaisedBedHarvest = visualRewards.some(
        (reward) =>
            isHarvestRewardForRaisedBed(reward, raisedBedId) &&
            isHarvestRewardCompleted(reward) &&
            reward.scope === 'raisedBed',
    );
    const harvestedFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isHarvestRewardForRaisedBed(reward, raisedBedId) &&
                    isHarvestRewardCompleted(reward) &&
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null,
            )
            .map((reward) => reward.raisedBedFieldId),
    );

    return Array.from(
        new Set(
            fields
                .filter((field) => {
                    const isHarvested =
                        hasRaisedBedHarvest ||
                        (typeof field.id === 'number' &&
                            harvestedFieldIds.has(field.id));

                    return (
                        isHarvested &&
                        isRaisedBedFieldOccupied(field) &&
                        field.positionIndex >= blockOffset &&
                        field.positionIndex < blockOffset + 9
                    );
                })
                .map((field) => field.positionIndex - blockOffset),
        ),
    ).sort((a, b) => a - b);
}

export function resolveRaisedBedHarvestBasketState({
    fields,
    hiddenOperationIds,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedHarvestBasketStateInput): RaisedBedHarvestBasketState | null {
    const harvestRewards = visualRewards.filter(
        (reward) =>
            isHarvestRewardForRaisedBed(reward, raisedBedId) &&
            !hiddenOperationIds?.has(reward.operationId),
    );

    if (harvestRewards.length === 0) {
        return null;
    }

    const occupiedFields = fields.filter(isRaisedBedFieldOccupied);
    const completedRaisedBedHarvest = harvestRewards.some(
        (reward) =>
            reward.scope === 'raisedBed' && isHarvestRewardCompleted(reward),
    );
    const completedFieldHarvestIds = new Set(
        harvestRewards
            .filter(
                (reward) =>
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null &&
                    isHarvestRewardCompleted(reward),
            )
            .map((reward) => reward.raisedBedFieldId),
    );
    const producePlantSortIds = occupiedFields.flatMap((field) => {
        const harvested =
            completedRaisedBedHarvest ||
            (typeof field.id === 'number' &&
                completedFieldHarvestIds.has(field.id));

        return harvested && field.plantSortId ? [field.plantSortId] : [];
    });
    const fillLevel =
        producePlantSortIds.length === 0
            ? 'empty'
            : completedRaisedBedHarvest ||
                producePlantSortIds.length >= occupiedFields.length
              ? 'full'
              : 'partial';

    return {
        fillLevel,
        operationIds: harvestRewards.map((reward) => reward.operationId),
        producePlantSortIds,
    };
}

function stackPositionKey(position: { x: number; z: number }) {
    return `${position.x}:${position.z}`;
}

function findStackAtPosition(
    stacks: Stack[],
    position: { x: number; z: number },
) {
    return stacks.find(
        (stack) =>
            stack.position.x === position.x && stack.position.z === position.z,
    );
}

function isFreeStackableStack(
    blockData: BlockData[] | null | undefined,
    stack: Stack | undefined,
) {
    const topBlock = stack?.blocks.at(-1);
    if (
        !topBlock ||
        stack?.blocks.some((block) => block.name === 'Raised_Bed')
    ) {
        return false;
    }

    return (
        getBlockDataByName(blockData, topBlock.name)?.attributes.stackable ??
        true
    );
}

export function resolveRaisedBedHarvestBasketPlacement({
    blockData,
    blockIds,
    reservedPositionKeys,
    stacks,
}: ResolveRaisedBedHarvestBasketPlacementInput): RaisedBedHarvestBasketPlacement | null {
    const raisedBedStacks = blockIds.flatMap((blockId) => {
        const stack = stacks.find((candidate) =>
            candidate.blocks.some((block) => block.id === blockId),
        );

        return stack ? [stack] : [];
    });
    const raisedBedPositionKeys = new Set(
        raisedBedStacks.map((stack) => stackPositionKey(stack.position)),
    );
    const neighborOffsets = [
        { x: 1, z: 0, rotation: Math.PI / 2 },
        { x: 0, z: 1, rotation: 0 },
        { x: -1, z: 0, rotation: -Math.PI / 2 },
        { x: 0, z: -1, rotation: Math.PI },
    ];
    const visited = new Set<string>();

    for (const raisedBedStack of raisedBedStacks) {
        for (const offset of neighborOffsets) {
            const destination = {
                x: raisedBedStack.position.x + offset.x,
                z: raisedBedStack.position.z + offset.z,
            };
            const key = stackPositionKey(destination);
            if (
                visited.has(key) ||
                raisedBedPositionKeys.has(key) ||
                reservedPositionKeys?.has(key)
            ) {
                continue;
            }

            visited.add(key);

            const stack = findStackAtPosition(stacks, destination);
            if (!isFreeStackableStack(blockData, stack)) {
                continue;
            }

            return {
                position: [
                    destination.x,
                    getStackHeight(blockData, stack),
                    destination.z,
                ],
                rotation: offset.rotation,
            };
        }
    }

    return null;
}

export function resolveRaisedBedHarvestBasketPlacements({
    blockData,
    raisedBeds,
    stacks,
}: ResolveRaisedBedHarvestBasketPlacementsInput) {
    const placements = new Map<number, RaisedBedHarvestBasketPlacement>();
    const reservedPositionKeys = new Set<string>();

    for (const raisedBed of [...raisedBeds].sort(
        (first, second) => first.raisedBedId - second.raisedBedId,
    )) {
        const placement = resolveRaisedBedHarvestBasketPlacement({
            blockData,
            blockIds: raisedBed.blockIds,
            reservedPositionKeys,
            stacks,
        });
        if (!placement) {
            continue;
        }

        placements.set(raisedBed.raisedBedId, placement);
        reservedPositionKeys.add(
            stackPositionKey({
                x: placement.position[0],
                z: placement.position[2],
            }),
        );
    }

    return placements;
}
