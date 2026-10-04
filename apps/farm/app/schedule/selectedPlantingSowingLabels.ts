import type { FieldOperationLabelData } from '@gredice/label-printer';

export const SOWING_LABEL_PLANT_LIMIT = 24;

export type SelectedPlantingSowingLabelInput = {
    dateLabel: string;
    physicalPositionNumbers: readonly number[];
    plantCount: number | null;
    plantSortName: string | null | undefined;
    raisedBedPhysicalId: string | null;
    sowingLocation: string | null | undefined;
};

function formatPieceCountLabel(count: number) {
    return `${count.toString()} ${count === 1 ? 'KOMAD' : 'KOMADA'}`;
}

function formatExactFootprint(positions: readonly number[]) {
    const sorted = Array.from(new Set(positions)).sort(
        (left, right) => left - right,
    );
    if (
        sorted.length !== positions.length ||
        sorted.some(
            (position) => !Number.isSafeInteger(position) || position <= 0,
        )
    ) {
        return null;
    }

    const first = sorted[0];
    const last = sorted.at(-1);
    if (first === undefined || last === undefined) {
        return null;
    }
    if (first === last) {
        return first.toString();
    }
    const consecutive = sorted.every((position, index) => {
        const previousPosition = sorted[index - 1];
        return (
            index === 0 ||
            (previousPosition !== undefined &&
                position === previousPosition + 1)
        );
    });
    return consecutive
        ? `${first.toString()}-${last.toString()}`
        : sorted.join(', ');
}

/**
 * Builds physical sowing labels from immutable selected-planting snapshots.
 * One logical planting may require multiple printer labels only when its
 * snapshotted plant count exceeds the established per-label limit.
 */
export function buildSelectedPlantingSowingLabels(
    inputs: readonly SelectedPlantingSowingLabelInput[],
) {
    const labels: FieldOperationLabelData[] = [];

    for (const input of inputs) {
        const plantSortName = input.plantSortName?.trim();
        const fieldLabel = formatExactFootprint(input.physicalPositionNumbers);
        if (
            input.sowingLocation !== 'greenhouse' ||
            !input.raisedBedPhysicalId ||
            !plantSortName ||
            !Number.isSafeInteger(input.plantCount) ||
            (input.plantCount ?? 0) <= 0 ||
            !fieldLabel
        ) {
            continue;
        }

        let remainingPlantCount = input.plantCount ?? 0;
        while (remainingPlantCount > 0) {
            const labelPlantCount = Math.min(
                remainingPlantCount,
                SOWING_LABEL_PLANT_LIMIT,
            );
            labels.push({
                dateLabel: input.dateLabel,
                detailLabel: formatPieceCountLabel(labelPlantCount),
                fieldLabel,
                plantSortName,
                raisedBedPhysicalId: input.raisedBedPhysicalId,
            });
            remainingPlantCount -= labelPlantCount;
        }
    }

    return labels;
}
