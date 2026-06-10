import type { OperationVisualReward } from '../../operationVisualRewards';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';

type RaisedBedSupportFieldInput = {
    active?: boolean | null;
    id: number | string;
    plantSortId?: number | null;
    positionIndex: number;
};

type ResolveRaisedBedSupportPositionsInput = {
    blockOffset: number;
    fields: RaisedBedSupportFieldInput[];
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

function isActiveSupportsReward(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        reward.family === 'supports' &&
        reward.raisedBedId === raisedBedId
    );
}

export function resolveRaisedBedSupportPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedSupportPositionsInput) {
    const hasRaisedBedSupports = visualRewards.some(
        (reward) =>
            isActiveSupportsReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );
    const supportedFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isActiveSupportsReward(reward, raisedBedId) &&
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null,
            )
            .map((reward) => reward.raisedBedFieldId),
    );

    return Array.from(
        new Set(
            fields
                .filter((field) => {
                    const isSupported =
                        hasRaisedBedSupports ||
                        (typeof field.id === 'number' &&
                            supportedFieldIds.has(field.id));

                    return (
                        isSupported &&
                        isRaisedBedFieldOccupied(field) &&
                        field.positionIndex >= blockOffset &&
                        field.positionIndex < blockOffset + 9
                    );
                })
                .map((field) => field.positionIndex - blockOffset),
        ),
    ).sort((a, b) => a - b);
}
