import type { OperationVisualReward } from '../../operationVisualRewards';

export type RaisedBedWeedLevel = 'none' | 'light' | 'heavy';

export type RaisedBedWeedStateInput = {
    level?: string | null;
    observedAt?: Date | string | null;
    updatedAt?: Date | string | null;
};

export type VisibleRaisedBedWeedLevel = Exclude<RaisedBedWeedLevel, 'none'>;

type ResolveRaisedBedFieldWeedLevelInput = {
    fieldWeedState?: RaisedBedWeedStateInput | null;
    raisedBedFieldId?: number | null;
    raisedBedId: number;
    raisedBedWeedState?: RaisedBedWeedStateInput | null;
    visualRewards: OperationVisualReward[];
};

function weedStateTimestampMs(
    weedState: RaisedBedWeedStateInput | null | undefined,
) {
    const value = weedState?.observedAt ?? weedState?.updatedAt;
    if (!value) {
        return 0;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function isRaisedBedWeedLevel(value: unknown): value is RaisedBedWeedLevel {
    return value === 'none' || value === 'light' || value === 'heavy';
}

function visibleWeedLevel(
    weedState: RaisedBedWeedStateInput | null | undefined,
): VisibleRaisedBedWeedLevel | null {
    if (!isRaisedBedWeedLevel(weedState?.level) || weedState.level === 'none') {
        return null;
    }

    return weedState.level;
}

function latestApplicableWeedingTimestampMs({
    raisedBedFieldId,
    raisedBedId,
    visualRewards,
}: {
    raisedBedFieldId?: number | null;
    raisedBedId: number;
    visualRewards: OperationVisualReward[];
}) {
    return visualRewards.reduce((latestTimestampMs, reward) => {
        if (reward.kind !== 'weeding' || reward.polarity !== 'remove') {
            return latestTimestampMs;
        }

        const appliesToRaisedBed =
            reward.scope === 'raisedBed' && reward.raisedBedId === raisedBedId;
        const appliesToField =
            raisedBedFieldId != null &&
            reward.scope === 'field' &&
            reward.raisedBedFieldId === raisedBedFieldId;

        if (!appliesToRaisedBed && !appliesToField) {
            return latestTimestampMs;
        }

        return Math.max(latestTimestampMs, reward.timestampMs);
    }, 0);
}

function latestWeedState(
    raisedBedWeedState: RaisedBedWeedStateInput | null | undefined,
    fieldWeedState: RaisedBedWeedStateInput | null | undefined,
) {
    if (!raisedBedWeedState) {
        return fieldWeedState ?? null;
    }
    if (!fieldWeedState) {
        return raisedBedWeedState;
    }

    return weedStateTimestampMs(fieldWeedState) >=
        weedStateTimestampMs(raisedBedWeedState)
        ? fieldWeedState
        : raisedBedWeedState;
}

export function resolveRaisedBedFieldWeedLevel({
    fieldWeedState,
    raisedBedFieldId,
    raisedBedId,
    raisedBedWeedState,
    visualRewards,
}: ResolveRaisedBedFieldWeedLevelInput): VisibleRaisedBedWeedLevel | null {
    const weedState = latestWeedState(raisedBedWeedState, fieldWeedState);
    const level = visibleWeedLevel(weedState);
    if (!level) {
        return null;
    }

    const weedStateTimestamp = weedStateTimestampMs(weedState);
    const latestWeedingTimestamp = latestApplicableWeedingTimestampMs({
        raisedBedFieldId,
        raisedBedId,
        visualRewards,
    });

    return latestWeedingTimestamp >= weedStateTimestamp ? null : level;
}
