import type {
    OperationVisualReward,
    OperationVisualRewardFamily,
} from '../../operationVisualRewards';

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

type RaisedBedCoverFamily = Extract<
    OperationVisualRewardFamily,
    'agrotextile' | 'insectMesh'
>;

function isActiveCoverReward(
    reward: OperationVisualReward,
    raisedBedId: number,
    family: RaisedBedCoverFamily,
) {
    return (
        reward.active &&
        reward.family === family &&
        reward.raisedBedId === raisedBedId
    );
}

function hasActiveRaisedBedCover({
    family,
    raisedBedId,
    visualRewards,
}: HasActiveRaisedBedProtectiveCoverInput & {
    family: RaisedBedCoverFamily;
}) {
    return visualRewards.some(
        (reward) =>
            isActiveCoverReward(reward, raisedBedId, family) &&
            reward.scope === 'raisedBed',
    );
}

function resolveRaisedBedCoverPositions({
    blockOffset,
    family,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedProtectiveCoverPositionsInput & {
    family: RaisedBedCoverFamily;
}) {
    if (
        hasActiveRaisedBedCover({
            family,
            raisedBedId,
            visualRewards,
        })
    ) {
        return Array.from({ length: 9 }, (_, positionIndex) => positionIndex);
    }

    const coveredFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    isActiveCoverReward(reward, raisedBedId, family) &&
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

export function hasActiveRaisedBedAgrotextileCover(
    input: HasActiveRaisedBedProtectiveCoverInput,
) {
    return hasActiveRaisedBedCover({ ...input, family: 'agrotextile' });
}

export function resolveRaisedBedAgrotextileCoverPositions(
    input: ResolveRaisedBedProtectiveCoverPositionsInput,
) {
    return resolveRaisedBedCoverPositions({
        ...input,
        family: 'agrotextile',
    });
}

export function hasActiveRaisedBedInsectMesh(
    input: HasActiveRaisedBedProtectiveCoverInput,
) {
    return hasActiveRaisedBedCover({ ...input, family: 'insectMesh' });
}

export function resolveRaisedBedInsectMeshPositions(
    input: ResolveRaisedBedProtectiveCoverPositionsInput,
) {
    return resolveRaisedBedCoverPositions({
        ...input,
        family: 'insectMesh',
    });
}

// Keep existing consumers on agrotextile semantics. Insect mesh has its own
// raised tunnel renderer and must not hide plants as an opaque cover.
export const hasActiveRaisedBedProtectiveCover =
    hasActiveRaisedBedAgrotextileCover;
export const resolveRaisedBedProtectiveCoverPositions =
    resolveRaisedBedAgrotextileCoverPositions;
