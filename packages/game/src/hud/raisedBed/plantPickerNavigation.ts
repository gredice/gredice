import type { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;

export type EmptyRaisedBedFieldTarget = {
    positionIndex: number;
    raisedBedId: number;
    raisedBedName: string;
};

export function findFirstEmptyRaisedBedField(
    garden: CurrentGardenData | null | undefined,
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
