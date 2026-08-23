import { isRaisedBedAbandoned } from '../../raisedBedConstants';
import type { GardenStack } from '../../types/Stack';
import { raisedBedFieldSectionCount } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getLegacySowingTargetAvailability,
    readAdvancedSowingCartItemSelectionSummary,
} from './advancedSowingSubmission';

type RaisedBedTargetField = {
    active?: boolean | null;
    plantSortId?: number | null;
    positionIndex: number;
};

type RaisedBedTarget = {
    blockId: string | null;
    fields: RaisedBedTargetField[];
    id: number;
    isValid: boolean;
    name?: string | null;
    orientation?: 'vertical' | 'horizontal';
    plantings?: unknown;
    status: string;
};

export type RaisedBedFieldTargetGarden = {
    id: number;
    isSandbox?: boolean | null;
    raisedBeds: RaisedBedTarget[];
    stacks: GardenStack[];
};

export type RaisedBedFieldTargetCartItem = {
    advancedSowingSelection?: unknown;
    entityTypeName?: string | null;
    gardenId?: number | null;
    positionIndex?: number | null;
    raisedBedId?: number | null;
    status?: string | null;
};

export type EmptyRaisedBedFieldTarget = {
    positionIndex: number;
    raisedBedId: number;
    raisedBedName: string;
};

type EmptyRaisedBedFieldTargetOptions = {
    includeAllFields?: boolean;
    includeNotYetActiveRaisedBeds?: boolean;
};

function isRaisedBedCartPlantItem(
    item: RaisedBedFieldTargetCartItem,
    gardenId: number,
    raisedBedId: number,
): item is RaisedBedFieldTargetCartItem & { positionIndex: number } {
    return (
        item.gardenId === gardenId &&
        item.raisedBedId === raisedBedId &&
        item.entityTypeName === 'plantSort' &&
        item.status === 'new' &&
        typeof item.positionIndex === 'number'
    );
}

function isRaisedBedEligibleForEmptyFieldTarget(
    raisedBed: RaisedBedTarget,
    options: EmptyRaisedBedFieldTargetOptions,
) {
    if (!raisedBed.isValid) {
        return false;
    }

    if (options.includeNotYetActiveRaisedBeds) {
        return !isRaisedBedAbandoned(raisedBed.status);
    }

    return raisedBed.status === 'active';
}

export function findEmptyRaisedBedFieldTargets(
    garden: RaisedBedFieldTargetGarden | null | undefined,
    cartItems?: RaisedBedFieldTargetCartItem[] | null,
    options: EmptyRaisedBedFieldTargetOptions = {},
): EmptyRaisedBedFieldTarget[] {
    if (!garden || garden.isSandbox) {
        return [];
    }

    const targets: EmptyRaisedBedFieldTarget[] = [];

    for (const raisedBed of garden.raisedBeds) {
        const raisedBedName = raisedBed.name?.trim();
        if (
            !raisedBedName ||
            !isRaisedBedEligibleForEmptyFieldTarget(raisedBed, options)
        ) {
            continue;
        }

        const blockCount = Math.max(raisedBedFieldSectionCount, 1);
        const occupiedPositionIndices = new Set(
            raisedBed.fields
                .filter(isRaisedBedFieldOccupied)
                .map((field) => field.positionIndex),
        );
        for (const item of cartItems ?? []) {
            if (isRaisedBedCartPlantItem(item, garden.id, raisedBed.id)) {
                const advancedSowingSelection =
                    readAdvancedSowingCartItemSelectionSummary(item);
                if (advancedSowingSelection) {
                    for (const occupiedPositionIndex of advancedSowingSelection.occupiedPositionIndices) {
                        occupiedPositionIndices.add(occupiedPositionIndex);
                    }
                } else {
                    occupiedPositionIndices.add(item.positionIndex);
                }
            }
        }

        for (
            let positionIndex = 0;
            positionIndex < blockCount * 9;
            positionIndex += 1
        ) {
            if (
                !occupiedPositionIndices.has(positionIndex) &&
                getLegacySowingTargetAvailability({
                    plantings: raisedBed.plantings,
                    positionIndex,
                }).available
            ) {
                targets.push({
                    positionIndex,
                    raisedBedId: raisedBed.id,
                    raisedBedName,
                });
                if (!options.includeAllFields) {
                    break;
                }
            }
        }
    }

    return targets;
}

export function findFirstEmptyRaisedBedField(
    garden: RaisedBedFieldTargetGarden | null | undefined,
    cartItems?: RaisedBedFieldTargetCartItem[] | null,
    options: EmptyRaisedBedFieldTargetOptions = {},
): EmptyRaisedBedFieldTarget | null {
    return (
        findEmptyRaisedBedFieldTargets(garden, cartItems, options)[0] ?? null
    );
}

export function waitForPlantPickerTrigger({
    positionIndex,
    raisedBedId,
}: EmptyRaisedBedFieldTarget) {
    if (typeof document === 'undefined') {
        return Promise.resolve(null);
    }

    const selector = [
        'button[data-raised-bed-plant-picker-trigger="true"]',
        `[data-raised-bed-id="${raisedBedId.toString()}"]`,
        `[data-position-index="${positionIndex.toString()}"]`,
    ].join('');

    return new Promise<HTMLButtonElement | null>((resolve) => {
        const deadline = Date.now() + 2500;

        function check() {
            const button = document.querySelector<HTMLButtonElement>(selector);
            if (button) {
                resolve(button);
                return;
            }

            if (Date.now() >= deadline) {
                resolve(null);
                return;
            }

            window.requestAnimationFrame(check);
        }

        check();
    });
}
