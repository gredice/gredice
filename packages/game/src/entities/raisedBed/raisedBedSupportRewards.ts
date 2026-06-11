import type { OperationVisualReward } from '../../operationVisualRewards';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';

type TimestampValue = Date | string | null | undefined;

type RaisedBedSupportFieldInput = {
    active?: boolean | null;
    id: number | string;
    plantCycles?: Array<{
        active?: boolean | null;
        startedAt?: TimestampValue;
    }> | null;
    plantSowDate?: TimestampValue;
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

function timestampMs(value: TimestampValue) {
    if (!value) {
        return null;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
}

function activePlantCycleStartMs(field: RaisedBedSupportFieldInput) {
    const activePlantCycle = field.plantCycles?.find(
        (plantCycle) => plantCycle.active,
    );

    return timestampMs(activePlantCycle?.startedAt);
}

function isSupportRewardCurrentForField(
    reward: OperationVisualReward,
    field: RaisedBedSupportFieldInput,
) {
    const cycleStartMs =
        activePlantCycleStartMs(field) ?? timestampMs(field.plantSowDate);
    if (cycleStartMs == null || reward.timestampMs <= 0) {
        return true;
    }

    return reward.timestampMs >= cycleStartMs;
}

export function resolveRaisedBedSupportPositions({
    blockOffset,
    fields,
    raisedBedId,
    visualRewards,
}: ResolveRaisedBedSupportPositionsInput) {
    const raisedBedSupportRewards = visualRewards.filter(
        (reward) =>
            isActiveSupportsReward(reward, raisedBedId) &&
            reward.scope === 'raisedBed',
    );
    const supportRewardsByFieldId = new Map(
        visualRewards
            .filter(
                (reward) =>
                    isActiveSupportsReward(reward, raisedBedId) &&
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null,
            )
            .map((reward) => [reward.raisedBedFieldId, reward]),
    );

    return Array.from(
        new Set(
            fields
                .filter((field) => {
                    const fieldSupportReward =
                        typeof field.id === 'number'
                            ? supportRewardsByFieldId.get(field.id)
                            : null;
                    const isSupported =
                        raisedBedSupportRewards.some((reward) =>
                            isSupportRewardCurrentForField(reward, field),
                        ) ||
                        Boolean(
                            fieldSupportReward &&
                                isSupportRewardCurrentForField(
                                    fieldSupportReward,
                                    field,
                                ),
                        );

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
