import type {
    AppliedOperationVisualInput,
    OperationVisualDefinitionInput,
    OperationVisualReward,
} from '../../operationVisualRewards';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import type { RaisedBedOrientation } from '../../utils/raisedBedOrientation';
import { getGridPositionFromIndex } from '../../utils/raisedBedOrientation';
import type { GroundPatchWetPatch } from '../helpers/groundPatchMaterial';
import { isWateringRewardVisible } from './raisedBedWateringRewards';

type RaisedBedWetPatchField = {
    active?: boolean | null;
    id?: number | null;
    plantSortId?: number | null;
    positionIndex: number;
};

type RaisedBedWetPatchData = {
    appliedOperations?: AppliedOperationVisualInput[] | null;
    fields: RaisedBedWetPatchField[];
    id: number;
    orientation?: RaisedBedOrientation | null;
};

export function getRaisedBedFieldSurfacePosition({
    blockIndex,
    orientation,
    positionIndex,
    y,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
    y: number;
}) {
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetZ =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierZ = orientation === 'vertical' ? 0.27 : 0.285;
    const { row, col } = getGridPositionFromIndex(positionIndex, orientation);
    return [
        col * multiplierX - offsetX,
        y,
        (2 - row) * multiplierZ - offsetZ,
    ] satisfies [number, number, number];
}

export function resolveRaisedBedWateringVisualRewards({
    operations,
    raisedBed,
}: {
    operations: OperationVisualDefinitionInput[] | undefined;
    raisedBed: RaisedBedWetPatchData | null | undefined;
}) {
    if (!operations || !raisedBed) {
        return [] as OperationVisualReward[];
    }

    return resolveOperationVisualRewards({
        appliedOperations: (raisedBed.appliedOperations ?? []).map(
            (operation) => ({
                ...operation,
                raisedBedId: raisedBed.id,
            }),
        ),
        operations,
    }).filter((reward) => reward.kind === 'watering');
}

export function getRaisedBedSoilWetPatches({
    blockIndex,
    blockOffset,
    blockPosition,
    currentTime,
    raisedBed,
    visualRewards,
}: {
    blockIndex: number;
    blockOffset: number;
    blockPosition: readonly [number, number, number];
    currentTime: Date;
    raisedBed: RaisedBedWetPatchData | null | undefined;
    visualRewards: readonly OperationVisualReward[];
}): GroundPatchWetPatch[] {
    if (!raisedBed) {
        return [];
    }

    const orientation = raisedBed.orientation ?? 'vertical';
    const patches: GroundPatchWetPatch[] = [];
    const fullRaisedBedWet = visualRewards.some(
        (reward) =>
            reward.scope === 'raisedBed' &&
            reward.raisedBedId === raisedBed.id &&
            isWateringRewardVisible(reward, currentTime),
    );

    if (fullRaisedBedWet) {
        patches.push({
            center: [blockPosition[0], blockPosition[2]],
            halfSize: [0.41, 0.41],
            strength: 0.94,
        });
    }

    const wetFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null &&
                    isWateringRewardVisible(reward, currentTime),
            )
            .map((reward) => reward.raisedBedFieldId),
    );

    if (wetFieldIds.size === 0) {
        return patches;
    }

    for (const field of raisedBed.fields) {
        if (
            field.active === false ||
            typeof field.id !== 'number' ||
            typeof field.plantSortId !== 'number' ||
            !wetFieldIds.has(field.id) ||
            field.positionIndex < blockOffset ||
            field.positionIndex >= blockOffset + 9
        ) {
            continue;
        }

        const localPosition = getRaisedBedFieldSurfacePosition({
            blockIndex,
            orientation,
            positionIndex: field.positionIndex - blockOffset,
            y: 0,
        });

        patches.push({
            center: [
                blockPosition[0] + localPosition[0],
                blockPosition[2] + localPosition[2],
            ],
            halfSize: [0.13, 0.13],
            strength: 1,
        });
    }

    return patches;
}
