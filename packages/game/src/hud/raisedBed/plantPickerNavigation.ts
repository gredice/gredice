import type { Stack } from '../../types/Stack';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';

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
    status: string;
};

export type RaisedBedFieldTargetGarden = {
    id: number;
    isSandbox?: boolean | null;
    raisedBeds: RaisedBedTarget[];
    stacks: Stack[];
};

export type RaisedBedFieldTargetCartItem = {
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

export function findFirstEmptyRaisedBedField(
    garden: RaisedBedFieldTargetGarden | null | undefined,
    cartItems?: RaisedBedFieldTargetCartItem[] | null,
): EmptyRaisedBedFieldTarget | null {
    if (!garden || garden.isSandbox) {
        return null;
    }

    for (const raisedBed of garden.raisedBeds) {
        const raisedBedName = raisedBed.name?.trim();
        if (
            !raisedBedName ||
            raisedBed.status !== 'active' ||
            !raisedBed.isValid
        ) {
            continue;
        }

        const blockCount = Math.max(
            getRaisedBedBlockIds(garden, raisedBed.id).length,
            1,
        );
        const occupiedPositionIndices = new Set(
            raisedBed.fields
                .filter(isRaisedBedFieldOccupied)
                .map((field) => field.positionIndex),
        );
        for (const item of cartItems ?? []) {
            if (isRaisedBedCartPlantItem(item, garden.id, raisedBed.id)) {
                occupiedPositionIndices.add(item.positionIndex);
            }
        }

        for (
            let positionIndex = 0;
            positionIndex < blockCount * 9;
            positionIndex += 1
        ) {
            if (!occupiedPositionIndices.has(positionIndex)) {
                return {
                    positionIndex,
                    raisedBedId: raisedBed.id,
                    raisedBedName,
                };
            }
        }
    }

    return null;
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
