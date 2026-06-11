import type { OperationVisualReward } from '../../operationVisualRewards';

type RaisedBedAgrotextileFieldInput = {
    active?: boolean | null;
    id: number | string;
    positionIndex: number;
};

type ResolveRaisedBedAgrotextileCoverPositionsInput = {
    blockOffset: number;
    fields: RaisedBedAgrotextileFieldInput[];
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

type HasActiveRaisedBedAgrotextileCoverInput = {
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

function isActiveAgrotextileReward(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        reward.family === 'agrotextile' &&
        reward.raisedBedId === raisedBedId
    );
}

export function hasActiveRaisedBedAgrotextileCover({
    raisedBedId,
    visualRewards,
}: HasActiveRaisedBedAgrotextileCoverInput) {
    return visualRewards.some(
        (reward) =>
            isActiveAgrotextileReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );
}

export function resolveRaisedBedAgrotextileCoverPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedAgrotextileCoverPositionsInput) {
    if (hasActiveRaisedBedAgrotextileCover({ raisedBedId, visualRewards })) {
        return Array.from({ length: 9 }, (_, positionIndex) => positionIndex);
    }

    const coveredFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isActiveAgrotextileReward(reward, raisedBedId) &&
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null,
            )
            .map((reward) => reward.raisedBedFieldId),
    );

    return Array.from(
        new Set(
            fields
                .filter(
                    (field) =>
                        field.active !== false &&
                        typeof field.id === 'number' &&
                        coveredFieldIds.has(field.id) &&
                        field.positionIndex >= blockOffset &&
                        field.positionIndex < blockOffset + 9,
                )
                .map((field) => field.positionIndex - blockOffset),
        ),
    ).sort((a, b) => a - b);
}
