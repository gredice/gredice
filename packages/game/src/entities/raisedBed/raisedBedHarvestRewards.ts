import type { OperationVisualReward } from '../../operationVisualRewards';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';

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

function isActiveHarvestReward(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        reward.family === 'harvest' &&
        reward.raisedBedId === raisedBedId
    );
}

export function resolveRaisedBedHarvestPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedHarvestPositionsInput) {
    const hasRaisedBedHarvest = visualRewards.some(
        (reward) =>
            isActiveHarvestReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );
    const harvestedFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isActiveHarvestReward(reward, raisedBedId) &&
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
