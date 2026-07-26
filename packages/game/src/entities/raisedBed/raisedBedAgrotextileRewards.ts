import type { OperationVisualReward } from '../../operationVisualRewards';

type RaisedBedProtectiveCoverFieldInput = {
    active?: boolean | null;
    id: number | string;
    positionIndex: number;
};

type ResolveRaisedBedProtectiveCoverPositionsInput = {
    blockOffset: number;
    fields: RaisedBedProtectiveCoverFieldInput[];
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

type HasActiveRaisedBedProtectiveCoverInput = {
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
};

function isActiveProtectiveCoverReward(
    reward: OperationVisualReward,
    raisedBedId: number,
) {
    return (
        reward.active &&
        (reward.family === 'agrotextile' || reward.family === 'insectMesh') &&
        reward.raisedBedId === raisedBedId
    );
}

export function hasActiveRaisedBedProtectiveCover({
    raisedBedId,
    visualRewards,
}: HasActiveRaisedBedProtectiveCoverInput) {
    return visualRewards.some(
        (reward) =>
            isActiveProtectiveCoverReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );
}

export function resolveRaisedBedProtectiveCoverPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedProtectiveCoverPositionsInput) {
    if (hasActiveRaisedBedProtectiveCover({ raisedBedId, visualRewards })) {
        return Array.from({ length: 9 }, (_, positionIndex) => positionIndex);
    }

    const coveredFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isActiveProtectiveCoverReward(reward, raisedBedId) &&
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

// Both operation families intentionally share this renderer. Preserve the
// original internal names for any existing consumers.
export const hasActiveRaisedBedAgrotextileCover =
    hasActiveRaisedBedProtectiveCover;
export const resolveRaisedBedAgrotextileCoverPositions =
    resolveRaisedBedProtectiveCoverPositions;
